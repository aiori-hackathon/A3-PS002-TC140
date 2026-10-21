'use strict';

const AccessLog = require('../models/AccessLog');

/**
 * Async batch queue for access log entries.
 * Entries are accumulated in memory and flushed to MongoDB in a single batch.
 */

const queue = [];

/**
 * Add a log entry to the queue.
 * @param {Object} logEntry - Fields matching AccessLog schema.
 */
function push(logEntry) {
  queue.push(logEntry);
}

/**
 * Flush all queued entries to the AccessLog collection and clear the queue.
 * @returns {number} Number of documents saved.
 */
async function flushLogs() {
  if (queue.length === 0) return 0;

  const toInsert = queue.splice(0, queue.length); // drain atomically
  await AccessLog.insertMany(toInsert);
  return toInsert.length;
}

/**
 * Inspect current queue without flushing (useful in tests).
 * @returns {Object[]} Current queue snapshot.
 */
function getQueue() {
  return [...queue];
}

module.exports = { push, flushLogs, getQueue };
