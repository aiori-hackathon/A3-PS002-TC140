'use strict';

const express        = require('express');
const enforceConsent = require('../middleware/enforceConsent');
const { SYNTHETIC_DATA } = require('../seed/seed');

const router = express.Router();

/**
 * Allowed data categories per purpose (mirrored from assertions.js).
 * Used to filter the synthetic data to only scoped fields.
 */
const ALLOWED_CATEGORIES = {
  P1_ANALYTICS:       ['appUsageEvents', 'sessionCount'],
  P2_PERSONALISATION: ['activitySummary', 'preferences'],
  P3_RESEARCH_SHARING:['pseudonymisedHeartRate', 'sleepHours'],
};

/**
 * GET /api/partnerhub/records?userId=...&purposeId=...
 *
 * Requires a valid, unexpired ES256 JWT in the Authorization header.
 * The enforceConsent middleware validates the token and live consent state
 * before this handler runs.
 *
 * Response: scoped subset of SYNTHETIC_DATA filtered to allowedCategories.
 */
router.get('/records', enforceConsent, (req, res) => {
  const { userId, purposeId } = req.query;

  const allowedCategories = ALLOWED_CATEGORIES[purposeId] || [];

  // Use synthetic data if known user, otherwise generate minimal synthetic data
  const knownUserData = (SYNTHETIC_DATA[userId] || {})[purposeId];
  const syntheticDefaults = {
    P1_ANALYTICS:       { appUsageEvents: ['app_open', 'session_start'], sessionCount: 1 },
    P2_PERSONALISATION: { activitySummary: 'General fitness', preferences: ['default'] },
    P3_RESEARCH_SHARING:{ pseudonymisedHeartRate: [72, 80], sleepHours: 7.0 },
  };
  const userDataForPurpose = knownUserData || syntheticDefaults[purposeId] || {};

  const scoped = {};
  for (const field of allowedCategories) {
    if (Object.prototype.hasOwnProperty.call(userDataForPurpose, field)) {
      scoped[field] = userDataForPurpose[field];
    }
  }

  return res.json({
    userId,
    purposeId,
    data: scoped,
    ...scoped,
    claims: req.consentClaims,
  });
});

module.exports = router;
