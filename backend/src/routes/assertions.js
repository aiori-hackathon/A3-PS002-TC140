'use strict';

const express = require('express');
const cacheService   = require('../services/cacheService');
const { getCurrent } = require('../services/noticeService');
const { decide }     = require('../services/consentService');
const { signJWT, sha256 } = require('../services/cryptoService');
const ConsentState   = require('../models/ConsentState');

const router = express.Router();

/**
 * Allowed data categories per purpose.
 */
const ALLOWED_CATEGORIES = {
  P1_ANALYTICS:       ['appUsageEvents', 'sessionCount'],
  P2_PERSONALISATION: ['activitySummary', 'preferences'],
  P3_RESEARCH_SHARING:['pseudonymisedHeartRate', 'sleepHours'],
};

/**
 * POST /api/assertions
 * Body: { userId, purposeId }
 *
 * Evaluates the current consent state and, if permitted, issues an ES256 JWT
 * scoped to the requested purpose.
 *
 * Responses:
 *   403 { reason }           — consent not granted / outdated / withdrawn
 *   200 { token, claims }    — JWT + decoded claims
 */
router.post('/', async (req, res) => {
  try {
    const { userId, purposeId } = req.body;

    if (!userId || !purposeId) {
      return res.status(400).json({ error: '`userId` and `purposeId` are required.' });
    }

    if (!ALLOWED_CATEGORIES[purposeId]) {
      return res.status(400).json({ error: `Unknown purposeId: ${purposeId}` });
    }

    // Load state from cache first, then DB
    let state = cacheService.get(userId, purposeId);
    if (!state) {
      state = await ConsentState.findOne({ userId, purposeId }).lean();
      if (state) cacheService.set(userId, purposeId, state);
    }

    const latestNotice = await getCurrent();
    const { allowed, reason } = decide(state, latestNotice, purposeId);

    if (!allowed) {
      return res.status(403).json({ reason });
    }

    // Build scope: SHA-256 of allowed categories joined by comma
    const allowedCategories = ALLOWED_CATEGORIES[purposeId];
    const scope = sha256(allowedCategories.join(','));

    const payload = {
      sub:     userId,
      purpose: purposeId,
      nv:      state.noticeVersion,
      cv:      state.cv,
      scope,
      aud:     'PartnerHub',
    };

    const token = signJWT(payload);

    // Decode without verifying again to return claims (includes iat/exp set by signJWT)
    const jwt = require('jsonwebtoken');
    const claims = jwt.decode(token);

    return res.json({ token, claims });
  } catch (err) {
    console.error('[POST /assertions]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
