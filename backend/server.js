'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const { connectDB }    = require('./src/config/db');
const { loadOrGenerateKeys } = require('./src/config/keys');
const { runSeed }      = require('./src/seed/seed');
const auditQueue       = require('./src/services/auditQueue');

// Route modules
const noticesRouter    = require('./src/routes/notices');
const consentRouter    = require('./src/routes/consent');
const assertionsRouter = require('./src/routes/assertions');
const partnerhubRouter = require('./src/routes/partnerhub');
const auditRouter      = require('./src/routes/audit');
const cacheRouter      = require('./src/routes/cache');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors()); // Allow all origins for prototype
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/notices',    noticesRouter);
app.use('/api/consent',    consentRouter);
app.use('/api/assertions', assertionsRouter);
app.use('/api/partnerhub', partnerhubRouter);
app.use('/api/audit',      auditRouter);
app.use('/api/cache',      cacheRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Audit queue flush — every 10 seconds ─────────────────────────────────────
let flushInterval;

async function startServer() {
  // 1. Generate or load EC keys
  loadOrGenerateKeys();

  // 2. Connect to MongoDB
  await connectDB();

  // 3. Seed initial data (idempotent)
  await runSeed();

  // 4. Start periodic audit log flush
  flushInterval = setInterval(async () => {
    try {
      const count = await auditQueue.flushLogs();
      if (count > 0) console.log(`[AuditQueue] Flushed ${count} log(s).`);
    } catch (err) {
      console.error('[AuditQueue] Flush error:', err);
    }
  }, 10_000);

  // 5. Start listening
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] ConsentGuard backend listening on port ${PORT} (0.0.0.0)`);
  });

  return server;
}

// Only auto-start when this file is the entry point
if (require.main === module) {
  startServer().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}

// Graceful shutdown helper (used by tests)
async function shutdown(server) {
  if (flushInterval) clearInterval(flushInterval);
  if (server) await new Promise((resolve) => server.close(resolve));
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

module.exports = app;
module.exports.app = app;
module.exports.startServer = startServer;
module.exports.shutdown = shutdown;
