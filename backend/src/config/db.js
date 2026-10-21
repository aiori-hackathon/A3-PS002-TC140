'use strict';

const mongoose = require('mongoose');

let memoryServer = null;

/**
 * Connect to MongoDB.
 * 
 * Logic:
 * 1. If MONGODB_URI is specified in environment and is not default localhost, connect to it.
 * 2. If no MONGODB_URI or default localhost is specified, try connecting to localhost with a 2-second timeout.
 * 3. If localhost is unreachable (e.g. MongoDB service not running on machine), automatically
 *    spin up an embedded MongoMemoryServer so the application runs 100% out-of-the-box
 *    without requiring the user to install or start a local MongoDB daemon!
 */
async function connectDB() {
  const customUri = process.env.MONGODB_URI;
  const isDefaultLocal = !customUri || customUri.includes('localhost:27017') || customUri.includes('127.0.0.1:27017');

  if (customUri && !isDefaultLocal) {
    console.log(`[DB] Connecting to configured MongoDB at ${customUri}...`);
    await mongoose.connect(customUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[DB] Connected successfully to remote/custom MongoDB.`);
    return;
  }

  // Try local MongoDB first with short timeout
  const localUri = customUri || 'mongodb://127.0.0.1:27017/consentguard';
  try {
    console.log(`[DB] Attempting connection to local MongoDB at ${localUri}...`);
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
    console.log(`[DB] Connected to local MongoDB daemon.`);
    return;
  } catch (err) {
    console.warn(`[DB] Local MongoDB daemon not reachable on localhost.`);
    console.log(`[DB] Starting embedded MongoDB instance (MongoMemoryServer) for zero-config execution...`);
    
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
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
  }
}

module.exports = { connectDB, disconnectDB };
