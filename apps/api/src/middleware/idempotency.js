const mongoose = require('mongoose');
const IdempotencyKey = require('../models/IdempotencyKey');

const KEY_REGEX = /^[a-zA-Z0-9_\-]{8,128}$/;
const KEY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Idempotency middleware for POST /orders.
 *
 * Clients supply X-Idempotency-Key with each request.
 * - Same user + same key → returns cached response if already completed.
 * - Concurrent duplicate → returns 409 while first request is processing.
 * - No key → 400 (required for order creation).
 *
 * Keys expire after 24 hours and are cleaned up by MongoDB TTL.
 */
async function requireIdempotencyKey(req, res, next) {
  const rawKey = req.headers['x-idempotency-key'];

  if (!rawKey) {
    return res.status(400).json({
      error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'X-Idempotency-Key header is required for order creation' },
    });
  }

  if (!KEY_REGEX.test(rawKey)) {
    return res.status(400).json({
      error: { code: 'INVALID_IDEMPOTENCY_KEY', message: 'X-Idempotency-Key must be 8–128 alphanumeric characters (hyphens and underscores allowed)' },
    });
  }

  const userId = req.user._id;

  // Try to atomically claim the key.
  //
  // Strategy: upsert with `new: false` (return pre-image).
  //   - Returns null  → we just created the record (first request) → proceed.
  //   - Returns a doc → the record already existed → inspect its status.
  //
  // A pre-generated _id is included in $setOnInsert so we know the record's
  // _id without a second round-trip when this is the inserting request.
  const newId = new mongoose.Types.ObjectId();
  let preImage;
  try {
    preImage = await IdempotencyKey.findOneAndUpdate(
      { userId, key: rawKey },
      {
        $setOnInsert: {
          _id: newId,
          userId,
          key: rawKey,
          status: 'processing',
          expiresAt: new Date(Date.now() + KEY_TTL_MS),
        },
      },
      { upsert: true, new: false },
    );
  } catch (err) {
    // Duplicate key error from the unique index means two requests raced
    // on the upsert at the exact same millisecond — treat as 409.
    if (err.code === 11000) {
      return res.status(409).json({
        error: { code: 'IDEMPOTENCY_CONFLICT', message: 'A request with this idempotency key is already being processed' },
      });
    }
    return next(err);
  }

  // preImage is null → we just inserted the record (this is the first request).
  if (!preImage) {
    req.idempotencyRecord = { _id: newId };
    return next();
  }

  // Found an existing record — check its terminal state.
  if (preImage.status === 'completed' && preImage.responseBody) {
    res.set('X-Idempotency-Replayed', 'true');
    return res.status(201).json(preImage.responseBody);
  }

  // 'processing': a previous request is still in-flight (or crashed mid-flight).
  // Return 409 unconditionally — the createdAt/updatedAt comparison was wrong
  // because $setOnInsert never updates updatedAt on an existing document,
  // so the timestamps were always equal and the guard never fired.
  return res.status(409).json({
    error: { code: 'IDEMPOTENCY_CONFLICT', message: 'A request with this idempotency key is already being processed' },
  });
}

/**
 * Call this after successfully creating an order to persist the response.
 */
async function completeIdempotencyKey(record, responseBody) {
  try {
    await IdempotencyKey.findByIdAndUpdate(record._id, {
      status: 'completed',
      responseBody,
    });
  } catch {
    // Non-fatal — duplicate requests will just re-run, which is safe
  }
}

module.exports = { requireIdempotencyKey, completeIdempotencyKey };
