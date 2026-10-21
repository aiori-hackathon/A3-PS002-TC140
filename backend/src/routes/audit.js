'use strict';

const express      = require('express');
const ConsentState = require('../models/ConsentState');
const ConsentEvent = require('../models/ConsentEvent');
const AccessLog    = require('../models/AccessLog');
const { computeHash } = require('../services/consentService');
const auditQueue   = require('../services/auditQueue');

const router = express.Router();

/**
 * GET /api/audit/export/:userId
 *
 * Returns a full audit bundle for a user:
 *   - consentState: all purpose states
 *   - events: all consent events ordered by seq
 *   - accessLogs: all access log entries
 *   - chainVerification: result of hash-chain verification
 */
router.get('/export/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [consentState, events, accessLogs] = await Promise.all([
      ConsentState.find({ userId }).lean(),
      ConsentEvent.find({ userId }).sort({ seq: 1 }).lean(),
      AccessLog.find({ userId }).sort({ timestamp: 1 }).lean(),
    ]);

    const chainVerification = verifyChain(events);

    return res.json({ userId, consentState, events, accessLogs, chainVerification });
  } catch (err) {
    console.error('[GET /audit/export/:userId]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /api/audit/verify/:userId
 *
 * Recomputes hashes sequentially and reports chain integrity.
 */
router.get('/verify/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const events = await ConsentEvent.find({ userId }).sort({ seq: 1 }).lean();
    const result = verifyChain(events);
    return res.json(result);
  } catch (err) {
    console.error('[GET /audit/verify/:userId]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/audit/simulate-tamper/:userId
 * Body: { seq, field, value }
 *
 * Directly mutates a field on a specific event document.
 * Intended solely for testing tamper-detection.
 */
router.post('/simulate-tamper/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { seq, field, value } = req.body;

    if (seq === undefined || !field) {
      return res.status(400).json({ error: '`seq` and `field` are required.' });
    }

    const result = await ConsentEvent.collection.updateOne(
      { userId, seq: Number(seq) },
      { $set: { [field]: value } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: `No event found for userId=${userId}, seq=${seq}` });
    }

    return res.json({ tampered: true, seq: Number(seq) });
  } catch (err) {
    console.error('[POST /audit/simulate-tamper/:userId]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/audit/flush-queue
 * Flush the in-memory access-log queue to MongoDB.
 * Useful in tests to force async logs to be written before asserting.
 */
router.post('/flush-queue', async (req, res) => {
  try {
    const count = await auditQueue.flushLogs();
    return res.json({ flushed: count });
  } catch (err) {
    console.error('[POST /audit/flush-queue]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * Verify the hash chain for an ordered list of events.
 *
 * @param {Object[]} events - ConsentEvent documents sorted by seq ascending.
 * @returns {{ chainValid: boolean, totalEvents: number } | { chainValid: false, firstBrokenSeq: number }}
 */
function verifyChain(events) {
  if (events.length === 0) {
    return { chainValid: true, totalEvents: 0 };
  }

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedPrev = i === 0 ? 'GENESIS' : events[i - 1].hash;
    if (event.prevHash !== expectedPrev) {
      return { chainValid: false, firstBrokenSeq: event.seq };
    }

    const payload = {
      userId:        event.userId,
      seq:           event.seq,
      purposeId:     event.purposeId,
      action:        event.action,
      noticeVersion: event.noticeVersion,
      cv:            event.cv,
      timestamp:     event.timestamp,
    };

    const expectedHash = computeHash(event.prevHash, payload);

    if (expectedHash !== event.hash) {
      return { chainValid: false, firstBrokenSeq: event.seq };
    }
  }

  return { chainValid: true, totalEvents: events.length };
}

module.exports = router;
