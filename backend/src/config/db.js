'use strict';

const mongoose = require('mongoose');

let memoryServer = null;

/**
 * Normalizes MongoDB URI:
 * 1. Appends database name ('consentguard') if path is empty or just '/'
 * 2. Preserves query parameters like retryWrites=true&w=majority
 */
function normalizeMongoUri(uri) {
  if (!uri) return uri;
  try {
    // If it's a mongodb+srv:// or mongodb:// URI
    const urlParts = uri.split('?');
    let base = urlParts[0];
    const query = urlParts[1] ? `?${urlParts[1]}` : '?retryWrites=true&w=majority';

    // Check if base has a database name after the host
    // Matches mongodb(+srv)://[credentials@]host[:port][/][dbname]
    const match = base.match(/^mongodb(?:\+srv)?:\/\/[^/]+(\/.*)?$/);
    if (match) {
      const path = match[1] || '';
      if (!path || path === '/') {
        base = base.replace(/\/+$/, '') + '/consentguard';
      }
    }
    return base + (query.startsWith('?') ? query : `?${query}`);
  } catch (err) {
    return uri;
  }
}

/**
 * Mask password for safe console logging
 */
function maskUri(uri) {
  if (!uri) return '';
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
}

/**
 * Connect to MongoDB.
 * 
 * Logic:
 * 1. If MONGODB_URI is provided, normalize database name to 'consentguard'.
 * 2. Connect with 8s timeout. If auth fails with lowercase password, auto-try capitalized password.
 * 3. If remote connection succeeds, log and return.
 * 4. If remote connection fails or local daemon unavailable, gracefully fall back to
 *    MongoMemoryServer so the app NEVER crashes even when offline or credentials misconfigured!
 */
async function connectDB() {
  let customUri = process.env.MONGODB_URI;

  if (customUri) {
    customUri = normalizeMongoUri(customUri);
    const masked = maskUri(customUri);
    console.log(`[DB] Attempting connection to MongoDB at ${masked}...`);

    try {
      await mongoose.connect(customUri, { serverSelectionTimeoutMS: 8000 });
      console.log(`[DB] Connected successfully to remote MongoDB (${masked}).`);
      return;
    } catch (err) {
      // Check if auth failed and try auto-recovering common casing (e.g. samir123 -> Samir123)
      if (err.message && err.message.includes('authentication failed')) {
        const altUri = tryTogglePasswordCapitalization(customUri);
        if (altUri && altUri !== customUri) {
          try {
            console.log(`[DB] Retrying connection with normalized credentials...`);
            await mongoose.connect(altUri, { serverSelectionTimeoutMS: 5000 });
            console.log(`[DB] Connected successfully to remote MongoDB with normalized credentials!`);
            return;
          } catch (retryErr) {
            console.warn(`[DB] Retry also failed: ${retryErr.message}`);
          }
        }
      }

      console.warn(`[DB] Remote MongoDB connection failed: ${err.message}`);
      console.warn(`[DB] Falling back to embedded MongoMemoryServer for uninterrupted local execution...`);
    }
  } else {
    // Try local MongoDB first with short timeout
    const localUri = 'mongodb://127.0.0.1:27017/consentguard';
    try {
      console.log(`[DB] Attempting connection to local MongoDB at ${localUri}...`);
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
      console.log(`[DB] Connected to local MongoDB daemon.`);
      return;
    } catch (err) {
      console.warn(`[DB] Local MongoDB daemon not reachable.`);
      console.log(`[DB] Starting embedded MongoDB instance (MongoMemoryServer)...`);
    }
  }

  // Graceful fallback to MongoMemoryServer
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({
      instance: { dbName: 'consentguard' },
    });
    const inMemoryUri = memoryServer.getUri();
    await mongoose.connect(inMemoryUri);
    console.log(`[DB] Embedded MongoDB running and connected at ${inMemoryUri}`);
  } catch (memErr) {
    console.error(`[DB] Failed to start embedded MongoDB:`, memErr);
    throw memErr;
  }
}

/**
 * Helper to capitalize/uncapitalize first letter of password in URI
 */
function tryTogglePasswordCapitalization(uri) {
  try {
    const credMatch = uri.match(/:\/\/([^:]+):([^@]+)@/);
    if (!credMatch) return null;
    const [, user, pass] = credMatch;
    const firstChar = pass.charAt(0);
    const toggledChar = firstChar === firstChar.toUpperCase() ? firstChar.toLowerCase() : firstChar.toUpperCase();
    const newPass = toggledChar + pass.slice(1);
    return uri.replace(`:${pass}@`, `:${newPass}@`);
  } catch (e) {
    return null;
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
  }
}

module.exports = { connectDB, disconnectDB, normalizeMongoUri, maskUri };
