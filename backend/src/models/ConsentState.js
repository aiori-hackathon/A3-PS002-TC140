'use strict';

const mongoose = require('mongoose');

const consentStateSchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true },
    purposeId: {
      type: String,
      enum: ['P1_ANALYTICS', 'P2_PERSONALISATION', 'P3_RESEARCH_SHARING'],
      required: true,
    },
    status: {
      type: String,
      enum: ['NONE', 'GRANTED', 'WITHDRAWN'],
      default: 'NONE',
    },
    noticeVersion: { type: Number },
    cv:            { type: Number, default: 0 },
    updatedAt:     { type: Date,   default: Date.now },
  },
  { collection: 'consent_state' }
);

// Compound unique index
consentStateSchema.index({ userId: 1, purposeId: 1 }, { unique: true });

module.exports = mongoose.model('ConsentState', consentStateSchema);
