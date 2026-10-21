'use strict';

const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true },
    consumer:  { type: String, default: 'PartnerHub' },
    purposeId: { type: String, required: true },
    decision:  { type: String, enum: ['ALLOWED', 'DENIED'], required: true },
    httpStatus:{ type: Number, required: true },
    reasonCode:{
      type: String,
      // OK | INVALID_TOKEN | SUBJECT_MISMATCH | PURPOSE_MISMATCH |
      // NO_CONSENT | CONSENT_WITHDRAWN | NOTICE_OUTDATED | TOKEN_STALE
      required: true,
    },
    tokenCv:   { type: Number },
    liveCv:    { type: Number },
    timestamp: { type: Date, default: Date.now },
  },
  { collection: 'access_logs' }
);

module.exports = mongoose.model('AccessLog', accessLogSchema);
