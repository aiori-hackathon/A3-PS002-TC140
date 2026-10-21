'use strict';

const express = require('express');
const { getCurrent, isOutdated } = require('../services/noticeService');
const { getOrCreateState, grant, withdraw } = require('../services/consentService');
const ConsentState = require('../models/ConsentState');

const router = express.Router();

/**
 * GET /api/notices/current
 * Returns the latest notice.
 * If ?userId=... is provided, also returns per-purpose outdated flags for that user.
 */
router.get('/current', async (req, res) => {
  try {
    const { getCurrent: getNotice, isOutdated: checkOutdated } = require('../services/noticeService');
    const notice = await getNotice();
    if (!notice) return res.status(404).json({ error: 'No notice published yet.' });

    const { userId } = req.query;
    let outdatedFlags = null;

    if (userId) {
      const purposes = ['P1_ANALYTICS', 'P2_PERSONALISATION', 'P3_RESEARCH_SHARING'];
      const states   = await ConsentState.find({ userId, purposeId: { $in: purposes } }).lean();
      const stateMap = Object.fromEntries(states.map((s) => [s.purposeId, s]));

      outdatedFlags = {};
      for (const pid of purposes) {
        const state = stateMap[pid];
        outdatedFlags[pid] = state
          ? checkOutdated(pid, state.noticeVersion, notice)
          : false;
      }
    }

    // Return the notice at the top level so res.body.version works in tests
    const payload = { ...notice };
    if (outdatedFlags) payload.outdatedFlags = outdatedFlags;
    return res.json(payload);
  } catch (err) {
    console.error('[GET /notices/current]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/notices/publish  (admin)
 * Body: { changeType, affectedPurposes, purposes? }
 * Publishes a new notice version.
 */
router.post('/publish', async (req, res) => {
  try {
    const { publish } = require('../services/noticeService');
    const { changeType, affectedPurposes, purposes } = req.body;

    if (!changeType) {
      return res.status(400).json({ error: '`changeType` is required.' });
    }

    const validChangeTypes = ['INITIAL', 'MATERIAL', 'TYPO_NON_MATERIAL'];
    if (!validChangeTypes.includes(changeType)) {
      return res.status(400).json({ error: `Invalid changeType. Must be one of: ${validChangeTypes.join(', ')}` });
    }

    const notice = await publish({ changeType, affectedPurposes: affectedPurposes || [], purposes });
    return res.status(201).json(notice);
  } catch (err) {
    console.error('[POST /notices/publish]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
