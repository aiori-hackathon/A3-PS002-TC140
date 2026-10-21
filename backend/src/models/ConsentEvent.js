'use strict';

const mongoose = require('mongoose');

const consentEventSchema = new mongoose.Schema(
  {
    userId:        { type: String, required: true },
    seq:           { type: Number, required: true }, // strictly increasing per user
    purposeId:     { type: String, required: true },
    action:        { type: String, enum: ['GRANT', 'WITHDRAW'], required: true },
    noticeVersion: { type: Number, required: true },
    cv:            { type: Number, required: true },
    timestamp:     { type: String, required: true }, // ISO string
    prevHash:      { type: String, required: true }, // "GENESIS" for seq=1
    hash:          { type: String, required: true }, // SHA256(prevHash + JSON.stringify({...}))
  },
  { collection: 'consent_events' }
);

// Append-only — no updates. Unique seq per user enforced logically.
consentEventSchema.index({ userId: 1, seq: 1 }, { unique: true });

module.exports = mongoose.model('ConsentEvent', consentEventSchema);
