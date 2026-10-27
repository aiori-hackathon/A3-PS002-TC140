'use strict';

const mongoose = require('mongoose');

let memoryServer = null;

/**
 * Robustly sanitizes and cleans MongoDB connection strings:
 * 1. Strips all accidental whitespace, newlines, and carriage returns (common during copy-paste in Render UI)
 * 2. Fixes accidental duplicated host appends (e.g. URI ending with duplicated @cluster0...)
 * 3. Safely auto-encodes special characters in the password (e.g. #, @, :, %) to prevent "Password contains unescaped characters"
 * 4. Ensures the database name ('consentguard') and standard parameters are present.
 */
function cleanMongoUri(rawUri) {
  if (!rawUri) return rawUri;

  // 1. Remove all newlines, carriage returns, and leading/trailing whitespace
  let uri = String(rawUri).trim().replace(/[\r\n\t ]+/g, '');

  const protoMatch = uri.match(/^mongodb(?:\+srv)?:\/\//);
  if (!protoMatch) return uri;

  const protocol = protoMatch[0];
  let rest = uri.slice(protocol.length);

  // 2. Detect and fix duplicated '@' (caused by copy-pasting URL twice)
  const atParts = rest.split('@');
  if (atParts.length > 2) {
    // If multiple '@' signs exist, keep the user:pass from part 0 and host from part 1
    const userPass = atParts[0];
    const host = atParts[1].split('/')[0].split('?')[0];
    rest = `${userPass}@${host}/consentguard?retryWrites=true&w=majority`;
    uri = protocol + rest;
  }

  // 3. Ensure database name (/consentguard)
  const querySplit = uri.split('?');
  let base = querySplit[0];
  const query = querySplit[1] ? `?${querySplit[1]}` : '?retryWrites=true&w=majority';

  const hostMatch = base.match(/^mongodb(?:\+srv)?:\/\/[^/]+(\/.*)?$/);
  if (hostMatch) {
    const path = hostMatch[1] || '';
    if (!path || path === '/') {
      base = base.replace(/\/+$/, '') + '/consentguard';
    }
  }
  uri = base + (query.startsWith('?') ? query : `?${query}`);

  // 4. Safely auto-encode password characters if unescaped
  try {
    const credMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@(.+)$/);
    if (credMatch) {
      const [, proto, user, pass, hostAndPath] = credMatch;
      // Decode first in case already partially encoded, then re-encode safely
      let decodedPass = pass;
      try {
        decodedPass = decodeURIComponent(pass);
      } catch (_) {}
      const encodedPass = encodeURIComponent(decodedPass);
      uri = `${proto}${user}:${encodedPass}@${hostAndPath}`;
    }
  } catch (_) {}

  return uri;
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
 * 1. Clean and normalize MONGODB_URI.
 * 2. Connect with 10s timeout to MongoDB Atlas.
 * 3. In production (Render): require working Atlas connection, giving clear troubleshooting if failed.
 * 4. In development: fall back to embedded MongoMemoryServer (MongoDB 7.0 for Debian 12 compatibility).
 */
async function connectDB() {
  let customUri = process.env.MONGODB_URI;

  if (customUri) {
    customUri = cleanMongoUri(customUri);
    const masked = maskUri(customUri);
    console.log(`[DB] Attempting connection to MongoDB at ${masked}...`);

    try {
      await mongoose.connect(customUri, { serverSelectionTimeoutMS: 10000 });
      console.log(`[DB] Connected successfully to remote MongoDB Atlas!`);
      return;
    } catch (err) {
      console.error(`[DB] Remote MongoDB connection failed: ${err.message}`);

      // In production (Render / Cloud), never attempt in-memory server
      if (process.env.NODE_ENV === 'production') {
        console.error(`[DB] Production environment detected (NODE_ENV=production).`);
        console.error(`[DB] In production, a valid MongoDB Atlas connection is required.`);
        console.error(`[DB] Troubleshooting steps for MongoDB Atlas:`);
        console.error(`  1. In MongoDB Atlas > Network Access, ensure IP 0.0.0.0/0 (Allow Anywhere) is added.`);
        console.error(`  2. In Render Dashboard > Environment Variables, verify MONGODB_URI is set on a single line without extra characters.`);
        throw err;
      }

      console.warn(`[DB] Falling back to embedded MongoMemoryServer for local development...`);
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

  // Fallback to MongoMemoryServer (configured with MongoDB 7.0 for Linux Debian 12 compatibility)
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({
      instance: { dbName: 'consentguard' },
      binary: { version: '7.0.14' },
    });
    const inMemoryUri = memoryServer.getUri();
    await mongoose.connect(inMemoryUri);
    console.log(`[DB] Embedded MongoDB running and connected at ${inMemoryUri}`);
  } catch (memErr) {
    console.error(`[DB] Failed to start embedded MongoDB:`, memErr);
    throw memErr;
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

module.exports = { connectDB, disconnectDB, cleanMongoUri, maskUri };
