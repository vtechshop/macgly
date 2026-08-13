/**
 * GST Verification Service
 *
 * Wraps a configurable external GST Suvidha Provider (GSP) API.
 * Set these environment variables to enable real verification:
 *   GST_API_URL  — e.g. https://api.gstprovider.example/v1/gstin
 *   GST_API_KEY  — API key issued by the provider
 *
 * When neither variable is set the service returns { status: 'unavailable' }
 * and callers MUST NOT set gstVerified: true.
 *
 * Verification states:
 *   verified    — provider confirmed GSTIN is active and matches the business
 *   failed      — provider responded but GSTIN is inactive / not found
 *   unavailable — no provider configured or provider returned an unexpected error
 */

const { GST_API_URL, GST_API_KEY } = require('../config/env');

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function formatGstin(raw) {
  return (raw || '').toUpperCase().trim();
}

/**
 * Verify a GSTIN with the configured provider.
 *
 * @param {string} gstin
 * @returns {{ status: 'verified'|'failed'|'unavailable', data?: object, referenceId?: string, verifiedAt?: Date }}
 */
async function verifyGstin(gstin) {
  const normalized = formatGstin(gstin);

  if (!GSTIN_REGEX.test(normalized)) {
    return { status: 'failed', reason: 'invalid_format' };
  }

  if (!GST_API_URL || !GST_API_KEY) {
    return {
      status: 'unavailable',
      reason: 'provider_not_configured',
    };
  }

  let response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    response = await fetch(`${GST_API_URL}/${encodeURIComponent(normalized)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${GST_API_KEY}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    return { status: 'unavailable', reason: 'provider_unreachable' };
  }

  if (!response.ok) {
    if (response.status === 404 || response.status === 422) {
      return { status: 'failed', reason: 'gstin_not_found' };
    }
    return { status: 'unavailable', reason: `provider_error_${response.status}` };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return { status: 'unavailable', reason: 'invalid_provider_response' };
  }

  // Normalise common provider response shapes
  // Most Indian GST APIs return: { status: 'ACT'|'INA', tradeNam, lgnm, sts, rgdt, ... }
  const isActive = (
    body.status === 'ACT' ||          // GSTN sandbox
    body.sts    === 'Active' ||       // some providers
    body.taxpayerType === 'Regular'   // alternate shape
  );

  if (!isActive) {
    return { status: 'failed', reason: 'gstin_inactive', referenceId: body.referenceId };
  }

  return {
    status: 'verified',
    referenceId: body.referenceId || body.txbId || null,
    verifiedAt: new Date(),
    data: {
      tradeName:   body.tradeNam || body.tradeName || null,
      legalName:   body.lgnm    || body.legalName  || null,
      gstStatus:   body.sts     || body.status      || null,
      stateCode:   normalized.slice(0, 2),
      pan:         normalized.slice(2, 12),
    },
  };
}

module.exports = { verifyGstin };
