'use strict';

const ConsentState = require('../models/ConsentState');
const ConsentEvent = require('../models/ConsentEvent');
const cacheService  = require('./cacheService');
const { sha256 }    = require('./cryptoService');
const { isOutdated, getCurrent } = require('./noticeService');

/**
 * Return the existing ConsentState for a user+purpose, or create one
 * with status=NONE if it doesn't exist yet.
 *
 * @param {string} userId
 * @param {string} purposeId
 * @returns {Promise<Object>} ConsentState document (plain object via lean)
 */
async function getOrCreateState(userId, purposeId) {
  let state = await ConsentState.findOne({ userId, purposeId }).lean();
  if (!state) {
    // Create with defaults; may race — handle duplicate-key error gracefully
    try {
      const doc = await ConsentState.create({ userId, purposeId, status: 'NONE', cv: 0 });
      state = doc.toObject();
    } catch (err) {
      if (err.code === 11000) {
        state = await ConsentState.findOne({ userId, purposeId }).lean();
      } else {
        throw err;
      }
    }
  }
  return state;
}

/**
 * Compute the next strictly-increasing sequence number for a user's event chain.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function getNextSeq(userId) {
  const count = await ConsentEvent.countDocuments({ userId });
  return count + 1;
}

/**
 * Compute the hash-chain hash for a consent event.
 * hash = SHA256(prevHash + JSON.stringify(payload))
 *
 * @param {string} prevHash
 * @param {Object} payload - { userId, seq, purposeId, action, noticeVersion, cv, timestamp }
 * @returns {string} Hex SHA-256 digest.
 */
function computeHash(prevHash, payload) {
  return sha256(prevHash + JSON.stringify(payload));
}

/**
 * Append a hash-chained event to consent_events.
 *
 * @param {string} userId
 * @param {string} purposeId
 * @param {'GRANT'|'WITHDRAW'} action
 * @param {number} noticeVersion
 * @param {number} cv            - New cv value after this action
 * @returns {Promise<Object>} Created ConsentEvent document.
 */
async function appendEvent(userId, purposeId, action, noticeVersion, cv) {
  const seq = await getNextSeq(userId);
  const timestamp = new Date().toISOString();

  // Find prevHash — last event for this user ordered by seq desc
  let prevHash = 'GENESIS';
  if (seq > 1) {
    const lastEvent = await ConsentEvent.findOne({ userId }).sort({ seq: -1 }).lean();
    if (lastEvent) prevHash = lastEvent.hash;
  }

  const payload = { userId, seq, purposeId, action, noticeVersion, cv, timestamp };
  const hash = computeHash(prevHash, payload);

  return ConsentEvent.create({ ...payload, prevHash, hash });
}

/**
 * Grant consent for a user+purpose.
 *
 * - Validates that noticeVersion matches the current notice.
 * - Upserts consent_state to GRANTED with incremented cv.
 * - Appends a GRANT event to the hash chain.
 * - Updates the in-memory cache.
 *
 * @param {string} userId
 * @param {string} purposeId
 * @param {number} noticeVersion - Version the user is consenting to.
 * @returns {Promise<Object>} Updated ConsentState (plain object).
 * @throws {Object} { code: 'NOTICE_OUTDATED' } if the version doesn't match current.
 */
async function grant(userId, purposeId, noticeVersion) {
  const currentNotice = await getCurrent();

  // noticeVersion must match the current notice version
  if (!currentNotice || noticeVersion !== currentNotice.version) {
    const err = new Error('Notice version is outdated or invalid.');
    err.code  = 'NOTICE_OUTDATED';
    throw err;
  }

  // Atomically upsert state and increment cv
  const updated = await ConsentState.findOneAndUpdate(
    { userId, purposeId },
    {
      $set: { status: 'GRANTED', noticeVersion, updatedAt: new Date() },
      $inc: { cv: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  // Append event
  await appendEvent(userId, purposeId, 'GRANT', noticeVersion, updated.cv);

  // Update cache
  cacheService.set(userId, purposeId, updated);

  return updated;
}

/**
 * Withdraw consent for a user+purpose.
 * Idempotent: if already WITHDRAWN, returns the current state without creating a new event.
 *
 * @param {string} userId
 * @param {string} purposeId
 * @returns {Promise<Object>} Updated ConsentState (plain object).
 */
async function withdraw(userId, purposeId) {
  // Ensure state exists
  const existing = await getOrCreateState(userId, purposeId);

  if (existing.status === 'WITHDRAWN') {
    // Already withdrawn — idempotent, return as-is
    return existing;
  }

  const updated = await ConsentState.findOneAndUpdate(
    { userId, purposeId },
    {
      $set: { status: 'WITHDRAWN', updatedAt: new Date() },
      $inc: { cv: 1 },
    },
    { new: true }
  ).lean();

  // Append event — use existing noticeVersion (can be null/0 if never granted)
  const noticeVersion = updated.noticeVersion || 0;
  await appendEvent(userId, purposeId, 'WITHDRAW', noticeVersion, updated.cv);

  // Update cache
  cacheService.set(userId, purposeId, updated);

  return updated;
}

/**
 * Convenience re-export of decide() so services can share the same logic.
 *
 * @param {Object|null} state
 * @param {Object|null} latestNotice
 * @param {string}      purposeId
 * @returns {{ allowed: boolean, reason?: string }}
 */
function decide(state, latestNotice, purposeId) {
  if (!state || state.status === 'NONE')      return { allowed: false, reason: 'NO_CONSENT' };
  if (state.status === 'WITHDRAWN')           return { allowed: false, reason: 'CONSENT_WITHDRAWN' };
  if (isOutdated(purposeId, state.noticeVersion, latestNotice))
                                              return { allowed: false, reason: 'NOTICE_OUTDATED' };
  return { allowed: true };
}

module.exports = { getOrCreateState, grant, withdraw, getNextSeq, computeHash, decide };
