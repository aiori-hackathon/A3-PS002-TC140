'use strict';

const { verifyJWT }   = require('../services/cryptoService');
const cacheService    = require('../services/cacheService');
const ConsentState    = require('../models/ConsentState');
const { getCurrent }  = require('../services/noticeService');
const { decide }      = require('../services/consentService');
const auditQueue      = require('../services/auditQueue');

/**
 * Build and enqueue an access-log entry.
 */
function logAccess({ userId, purposeId, decision, httpStatus, reasonCode, tokenCv, liveCv }) {
  auditQueue.push({
    userId,
    consumer:   'PartnerHub',
    purposeId,
    decision,
    httpStatus,
    reasonCode,
    tokenCv:    tokenCv !== undefined ? tokenCv : null,
    liveCv:     liveCv  !== undefined ? liveCv  : null,
  });
}

/**
 * Middleware: Enforce consent gate before serving protected resources.
 *
 * Pipeline:
 *  1. Extract Bearer token from Authorization header.
 *  2. verifyJWT(token) — 401 INVALID_TOKEN on failure.
 *  3. Check claims.aud === 'PartnerHub' — 401 INVALID_TOKEN.
 *  4. Check claims.sub === req.query.userId — 403 SUBJECT_MISMATCH.
 *  5. Check claims.purpose === req.query.purposeId — 403 PURPOSE_MISMATCH.
 *  6. Load live state from cache, falling back to DB; populate cache on miss.
 *  7. Run decide(state, latestNotice, purposeId) — 403 + reason on denial.
 *  8. Check claims.cv === state.cv — 403 TOKEN_STALE.
 *  9. Log ALLOWED (200, OK).
 * 10. Attach req.consentClaims and req.liveState, then call next().
 */
async function enforceConsent(req, res, next) {
  const { userId, purposeId } = req.query;

  // --- Step 1: Extract token ---
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    logAccess({ userId, purposeId, decision: 'DENIED', httpStatus: 401, reasonCode: 'INVALID_TOKEN' });
    return res.status(401).json({ error: 'Missing or malformed Authorization header.', reason: 'INVALID_TOKEN', reasonCode: 'INVALID_TOKEN' });
  }

  // --- Step 2: Verify JWT ---
  let claims;
  try {
    claims = verifyJWT(token);
  } catch (_err) {
    logAccess({ userId, purposeId, decision: 'DENIED', httpStatus: 401, reasonCode: 'INVALID_TOKEN' });
    return res.status(401).json({ error: 'Invalid or expired token.', reason: 'INVALID_TOKEN', reasonCode: 'INVALID_TOKEN' });
  }

  // --- Step 3: Audience check ---
  if (claims.aud !== 'PartnerHub') {
    logAccess({ userId, purposeId, decision: 'DENIED', httpStatus: 401, reasonCode: 'INVALID_TOKEN', tokenCv: claims.cv });
    return res.status(401).json({ error: 'Token audience mismatch.', reason: 'INVALID_TOKEN', reasonCode: 'INVALID_TOKEN' });
  }

  // --- Step 4: Subject check ---
  if (claims.sub !== userId) {
    logAccess({ userId, purposeId, decision: 'DENIED', httpStatus: 403, reasonCode: 'SUBJECT_MISMATCH', tokenCv: claims.cv });
    return res.status(403).json({ error: 'Token subject does not match userId.', reason: 'SUBJECT_MISMATCH', reasonCode: 'SUBJECT_MISMATCH' });
  }

  // --- Step 5: Purpose check ---
  if (claims.purpose !== purposeId) {
    logAccess({ userId, purposeId, decision: 'DENIED', httpStatus: 403, reasonCode: 'PURPOSE_MISMATCH', tokenCv: claims.cv });
    return res.status(403).json({ error: 'Token purpose does not match purposeId.', reason: 'PURPOSE_MISMATCH', reasonCode: 'PURPOSE_MISMATCH' });
  }

  // --- Step 6: Load live state ---
  let state = cacheService.get(userId, purposeId);
  if (!state) {
    state = await ConsentState.findOne({ userId, purposeId }).lean();
    if (state) cacheService.set(userId, purposeId, state);
  }

  // --- Step 7: Run decide() ---
  const latestNotice = await getCurrent();
  const { allowed, reason } = decide(state, latestNotice, purposeId);

  if (!allowed) {
    logAccess({
      userId, purposeId,
      decision: 'DENIED', httpStatus: 403, reasonCode: reason,
      tokenCv: claims.cv, liveCv: state ? state.cv : undefined,
    });
    return res.status(403).json({ error: reason, reason, reasonCode: reason });
  }

  // --- Step 8: CV freshness check ---
  if (claims.cv !== state.cv) {
    logAccess({
      userId, purposeId,
      decision: 'DENIED', httpStatus: 403, reasonCode: 'TOKEN_STALE',
      tokenCv: claims.cv, liveCv: state.cv,
    });
    return res.status(403).json({ error: 'Token cv is stale.', reason: 'TOKEN_STALE', reasonCode: 'TOKEN_STALE' });
  }

  // --- Step 9 & 10: Log ALLOWED and continue ---
  logAccess({
    userId, purposeId,
    decision: 'ALLOWED', httpStatus: 200, reasonCode: 'OK',
    tokenCv: claims.cv, liveCv: state.cv,
  });

  req.consentClaims = claims;
  req.liveState     = state;
  return next();
}

module.exports = enforceConsent;
