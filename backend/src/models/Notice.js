'use strict';

const mongoose = require('mongoose');

const purposeSchema = new mongoose.Schema(
  {
    title:                { type: String, required: true },
    description:          { type: String, required: true },
    dataCategories:       { type: [String], default: [] },
    materialChangeFromPrev: { type: Boolean, default: false },
  },
  { _id: false }
);

const noticeSchema = new mongoose.Schema(
  {
    version:     { type: Number, unique: true, required: true },
    publishedAt: { type: Date, default: Date.now },
    purposes: {
      P1_ANALYTICS:       { type: purposeSchema, required: true },
      P2_PERSONALISATION: { type: purposeSchema, required: true },
      P3_RESEARCH_SHARING:{ type: purposeSchema, required: true },
    },
    changeType: {
      type: String,
      enum: ['INITIAL', 'MATERIAL', 'TYPO_NON_MATERIAL'],
      required: true,
    },
    affectedPurposes: { type: [String], default: [] },
  },
  { collection: 'notices' }
);

module.exports = mongoose.model('Notice', noticeSchema);
