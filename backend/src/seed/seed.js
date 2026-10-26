'use strict';

/**
 * Synthetic user data and seed constants for ConsentGuard.
 *
 * SYNTHETIC_DATA is structured as:
 *   SYNTHETIC_DATA[userId][purposeId] = { ...purposeSpecificFields }
 *
 * USERS is the list of seeded user identifiers.
 */

const USERS = ['alice', 'bob'];

const SYNTHETIC_DATA = {
  alice: {
    P1_ANALYTICS: {
      appUsageEvents: ['app_open', 'workout_logged', 'screen_time_42m'],
      sessionCount:   14,
    },
    P2_PERSONALISATION: {
      activitySummary: 'High intensity cardio',
      preferences:     ['morning_runs', 'low_carb_tips'],
    },
    P3_RESEARCH_SHARING: {
      pseudonymisedHeartRate: [72, 118, 145, 88],
      sleepHours:             7.4,
    },
  },
  bob: {
    P1_ANALYTICS: {
      appUsageEvents: ['app_open', 'workout_logged', 'screen_time_42m'],
      sessionCount:   14,
    },
    P2_PERSONALISATION: {
      activitySummary: 'High intensity cardio',
      preferences:     ['morning_runs', 'low_carb_tips'],
    },
    P3_RESEARCH_SHARING: {
      pseudonymisedHeartRate: [72, 118, 145, 88],
      sleepHours:             7.4,
    },
  },
};

/**
 * Initial notice v1 definition used during seeding.
 */
const INITIAL_NOTICE_V1 = {
  version:    1,
  changeType: 'INITIAL',
  affectedPurposes: [],
  purposes: {
    P1_ANALYTICS: {
      title:       'Analytics',
      description: 'We collect anonymous usage analytics to understand how users interact with the app.',
      dataCategories: ['appUsageEvents', 'sessionCount'],
      materialChangeFromPrev: false,
    },
    P2_PERSONALISATION: {
      title:       'Personalisation',
      description: 'We use your activity data to personalise your health and fitness recommendations.',
      dataCategories: ['activitySummary', 'preferences'],
      materialChangeFromPrev: false,
    },
    P3_RESEARCH_SHARING: {
      title:       'Research Sharing',
      description: 'We may share pseudonymised health metrics with research partners.',
      dataCategories: ['pseudonymisedHeartRate', 'sleepHours'],
      materialChangeFromPrev: false,
    },
  },
};

/**
 * Seed function: inserts Notice v1 if it doesn't already exist.
 * Safe to call multiple times (idempotent).
 *
 * When run as a standalone script (node src/seed/seed.js), this function
 * connects to MongoDB, seeds the data, and disconnects.
 */
async function runSeed() {
  const mongoose = require('mongoose');
  const Notice   = require('../models/Notice');
  const { connectDB, disconnectDB } = require('../config/db');

  const alreadyConnected = mongoose.connection.readyState === 1;

  if (!alreadyConnected) {
    await connectDB();
    console.log('[Seed] Connected to MongoDB.');
  }

  const existing = await Notice.findOne({ version: 1 });
  if (!existing) {
    await Notice.create(INITIAL_NOTICE_V1);
    console.log('[Seed] Inserted Notice v1.');
  } else {
    console.log('[Seed] Notice v1 already exists — skipping.');
  }

  if (!alreadyConnected) {
    await disconnectDB();
    console.log('[Seed] Disconnected from MongoDB.');
  }
}

module.exports = { SYNTHETIC_DATA, USERS, INITIAL_NOTICE_V1, runSeed };

// Allow running directly: node src/seed/seed.js
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
  runSeed().catch((err) => {
    console.error('[Seed] Error:', err);
    process.exit(1);
  });
}
