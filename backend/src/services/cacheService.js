'use strict';

/**
 * In-memory cache for consent state objects.
 * Key format: `${userId}:${purposeId}`
 */

const cache = new Map();

/**
 * Build the cache key.
 */
function getKey(userId, purposeId) {
  return `${userId}:${purposeId}`;
}

/**
 * Retrieve a cached state, or null if not present.
 */
function get(userId, purposeId) {
  const key = getKey(userId, purposeId);
  return cache.has(key) ? cache.get(key) : null;
}

/**
 * Store a state in the cache.
 */
function set(userId, purposeId, state) {
  cache.set(getKey(userId, purposeId), state);
}

/**
 * Remove a single entry from the cache.
 */
function del(userId, purposeId) {
  cache.delete(getKey(userId, purposeId));
}

/**
 * Clear all cached entries.
 */
function clear() {
  cache.clear();
}

module.exports = { get, set, del, clear, getKey };
