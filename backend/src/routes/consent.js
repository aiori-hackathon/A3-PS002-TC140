'use strict';

const express = require('express');
const { getCurrent, isOutdated } = require('../services/noticeService');
const { getOrCreateState, grant, withdraw } = require('../services/consentService');
const ConsentState = require('../models/ConsentState');

const router = express.Router();

const ALL_PURPOSES = ['P1_ANALYTICS', 'P2_PERSONALISATION', 'P3_RESEARCH_SHARING'];

/**
 * GET /api/consent/:userId
 * Returns all 3 purpose states, the current notice, and per-purpose outdated flags.
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const notice = await getCurrent();

    // Ensure all 3 states exist
    await Promise.all(ALL_PURPOSES.map((pid) => getOrCreateState(userId, pid)));

    const states = await ConsentState.find({ userId, purposeId: { $in: ALL_PURPOSES } }).lean();
    const stateMap = Object.fromEntries(states.map((s) => [s.purposeId, s]));

    const outdatedFlags = {};
    for (const pid of ALL_PURPOSES) {
      const state = stateMap[pid];
      outdatedFlags[pid] = state && notice
        ? isOutdated(pid, state.noticeVersion, notice)
        : false;
    }

    const statesArray = Object.values(stateMap);
    return res.json({
      userId,
      purposes: stateMap,
      states: statesArray,
      notice,
      currentNotice: notice,
      outdatedFlags,
      needsReConsent: outdatedFlags,
    });
  } catch (err) {
    console.error('[GET /consent/:userId]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/consent/grant
 * Body: { userId, purposeId, noticeVersion }
 * Grants consent. Returns 409 if notice version is outdated.
 */
router.post('/grant', async (req, res) => {
  try {
    const { userId, purposeId, noticeVersion } = req.body;

    if (!userId || !purposeId || noticeVersion === undefined) {
      return res.status(400).json({ error: '`userId`, `purposeId`, and `noticeVersion` are required.' });
    }

    const state = await grant(userId, purposeId, Number(noticeVersion));
    return res.json({ status: state.status, cv: state.cv, noticeVersion: state.noticeVersion });
  } catch (err) {
    if (err.code === 'NOTICE_OUTDATED') {
      return res.status(409).json({ error: 'NOTICE_OUTDATED', message: err.message });
    }
    console.error('[POST /consent/grant]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/consent/withdraw
 * Body: { userId, purposeId }
 * Withdraws consent. Idempotent.
 */
router.post('/withdraw', async (req, res) => {
  try {
    const { userId, purposeId } = req.body;

    if (!userId || !purposeId) {
      return res.status(400).json({ error: '`userId` and `purposeId` are required.' });
    }

    const state = await withdraw(userId, purposeId);
    return res.json({ status: state.status, cv: state.cv });
  } catch (err) {
    console.error('[POST /consent/withdraw]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
