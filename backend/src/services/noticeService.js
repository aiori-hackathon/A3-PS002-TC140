'use strict';

const Notice = require('../models/Notice');

/**
 * Retrieve the latest published notice (highest version number).
 *
 * @returns {Promise<Object|null>} Latest Notice document, or null if none exist.
 */
async function getCurrent() {
  return Notice.findOne().sort({ version: -1 }).lean();
}

/**
 * Publish a new notice. Automatically increments the version.
 *
 * @param {Object} noticeData
 * @param {string} noticeData.changeType       - 'INITIAL' | 'MATERIAL' | 'TYPO_NON_MATERIAL'
 * @param {string[]} noticeData.affectedPurposes
 * @param {Object} [noticeData.purposes]       - Optional per-purpose overrides (merged with defaults)
 * @returns {Promise<Object>} The newly created Notice document.
 */
async function publish(noticeData) {
  const current = await getCurrent();
  const nextVersion = noticeData.version !== undefined
    ? Number(noticeData.version)
    : (current ? current.version + 1 : 1);

  // Build purposes by merging existing or defaults with incoming overrides
  const basePurposes = current
    ? JSON.parse(JSON.stringify(current.purposes))
    : {
        P1_ANALYTICS: {
          title: 'Analytics',
          description: 'Collect analytics data.',
          dataCategories: ['appUsageEvents', 'sessionCount'],
          materialChangeFromPrev: false,
        },
        P2_PERSONALISATION: {
          title: 'Personalisation',
          description: 'Personalise your experience.',
          dataCategories: ['activitySummary', 'preferences'],
          materialChangeFromPrev: false,
        },
        P3_RESEARCH_SHARING: {
          title: 'Research Sharing',
          description: 'Share pseudonymised data for research.',
          dataCategories: ['pseudonymisedHeartRate', 'sleepHours'],
          materialChangeFromPrev: false,
        },
      };

  // Reset materialChangeFromPrev flags
  for (const key of Object.keys(basePurposes)) {
    basePurposes[key].materialChangeFromPrev = false;
  }

  // Apply overrides from request body if supplied
  if (noticeData.purposes) {
    for (const [pid, override] of Object.entries(noticeData.purposes)) {
      if (basePurposes[pid]) {
        Object.assign(basePurposes[pid], override);
      }
    }
  }

  // Mark material changes on affected purposes
  if (noticeData.changeType === 'MATERIAL' && Array.isArray(noticeData.affectedPurposes)) {
    for (const pid of noticeData.affectedPurposes) {
      if (basePurposes[pid]) {
        basePurposes[pid].materialChangeFromPrev = true;
      }
    }
  }

  const notice = await Notice.create({
    version:          nextVersion,
    changeType:       noticeData.changeType,
    affectedPurposes: noticeData.affectedPurposes || [],
    purposes:         basePurposes,
  });

  return notice;
}

/**
 * Determine whether a user's recorded consent for a purpose is outdated
 * relative to the current live notice.
 *
 * A consent is outdated when:
 *  - The current notice has changeType === 'MATERIAL'
 *  - The purposeId is listed in affectedPurposes
 *  - The current notice version is higher than the version the user consented to
 *
 * @param {string} purposeId
 * @param {number} consentNoticeVersion  - The version stored in the user's ConsentState
 * @param {Object} currentNotice         - Latest notice document
 * @returns {boolean}
 */
function isOutdated(purposeId, consentNoticeVersion, currentNotice) {
  if (!currentNotice) return false;
  if (currentNotice.changeType !== 'MATERIAL') return false;
  if (!currentNotice.affectedPurposes.includes(purposeId)) return false;
  return currentNotice.version > consentNoticeVersion;
}

module.exports = { getCurrent, publish, isOutdated };
