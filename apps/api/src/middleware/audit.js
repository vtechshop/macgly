const AuditLog = require('../models/AuditLog');

const SENSITIVE_FIELDS = new Set([
  'password', 'otp', 'token', 'secret', 'apiKey', 'pan', 'aadhaar',
  'bankAccount', 'accountNumber', 'ifsc', 'cvv', 'cardNumber',
]);

function redactMeta(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[k] = redactMeta(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Write an audit event. Fire-and-forget — never throws.
 * @param {object} opts
 * @param {string}   opts.action      - e.g. 'BANK_DETAILS_CHANGED'
 * @param {*}        [opts.actor]     - ObjectId of acting user
 * @param {string}   [opts.actorRole] - role string
 * @param {*}        [opts.target]    - ObjectId of affected document
 * @param {string}   [opts.targetModel]
 * @param {string}   [opts.ip]
 * @param {string}   [opts.userAgent]
 * @param {object}   [opts.meta]      - additional context (redacted automatically)
 */
function writeAuditLog(opts) {
  setImmediate(async () => {
    try {
      await AuditLog.create({
        actor:       opts.actor       || null,
        actorRole:   opts.actorRole   || 'system',
        action:      opts.action,
        target:      opts.target      || null,
        targetModel: opts.targetModel || null,
        ip:          opts.ip          || null,
        userAgent:   opts.userAgent   || null,
        meta:        redactMeta(opts.meta || {}),
      });
    } catch {
      // Audit failures must never break the main request
    }
  });
}

/**
 * Extract audit fields from an Express request.
 */
function fromReq(req) {
  return {
    actor:     req.user?._id   || null,
    actorRole: req.user?.role  || 'anonymous',
    ip:        req.ip          || req.socket?.remoteAddress || null,
    userAgent: req.get('user-agent') || null,
  };
}

module.exports = { writeAuditLog, fromReq };
