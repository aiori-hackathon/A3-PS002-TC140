'use strict';

const express      = require('express');
const cacheService = require('../services/cacheService');

const router = express.Router();

/**
 * POST /api/cache/clear
 * Clears the entire in-memory consent cache.
 * Useful in tests (T20) to verify DB fallback.
 */
router.post('/clear', (req, res) => {
  cacheService.clear();
  return res.json({ cleared: true });
});

module.exports = router;
