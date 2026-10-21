'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request  = require('supertest');

let mongod;
let app;

// Helper to get current notice version dynamically
async function getCurrentNotice() {
  const res = await request(app).get('/api/notices/current');
  return res.body;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.PORT = '0'; // do not bind actual port in test mode

  // Require app after setting MONGODB_URI
  const serverModule = require('../server');
  app = serverModule.app || serverModule;

  // Connect mongoose to test database
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri);
  }

  // Clear any existing data
  await mongoose.connection.dropDatabase();

  // Seed notice v1
  await request(app)
    .post('/api/notices/publish')
    .send({
      version: 1,
      changeType: 'INITIAL',
      affectedPurposes: [],
      purposes: {
        P1_ANALYTICS: {
          title: 'Analytics',
          description: 'Collect anonymous app usage events.',
          dataCategories: ['appUsageEvents', 'sessionCount'],
          materialChangeFromPrev: false,
        },
        P2_PERSONALISATION: {
          title: 'Personalisation',
          description: 'Personalise user fitness experience.',
          dataCategories: ['activitySummary', 'preferences'],
          materialChangeFromPrev: false,
        },
        P3_RESEARCH_SHARING: {
          title: 'Research Sharing',
          description: 'Share pseudonymised data with research institutions.',
          dataCategories: ['pseudonymisedHeartRate', 'sleepHours'],
          materialChangeFromPrev: false,
        },
      },
    });
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
});

describe('ConsentGuard Lifecycle Tests (T01 - T20)', () => {

  // --------------------------------------------------------------------------
  // T01: Grant P1 with notice v1 -> 200 GRANTED, cv = 1, event stores noticeVersion = 1
  // --------------------------------------------------------------------------
  test('T01: Grant P1 with notice v1 -> 200 GRANTED, cv = 1, event stores noticeVersion = 1', async () => {
    const userId = `user_T01_${Date.now()}`;

    const grantRes = await request(app)
      .post('/api/consent/grant')
      .send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: 1 });

    expect(grantRes.status).toBe(200);
    expect(grantRes.body.status).toBe('GRANTED');
    expect(grantRes.body.cv).toBe(1);
    expect(grantRes.body.noticeVersion).toBe(1);

    // Verify stored event in ledger
    const auditRes = await request(app).get(`/api/audit/export/${userId}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.events).toHaveLength(1);
    const ev = auditRes.body.events[0];
    expect(ev.action).toBe('GRANT');
    expect(ev.purposeId).toBe('P1_ANALYTICS');
    expect(ev.noticeVersion).toBe(1);
    expect(ev.cv).toBe(1);
    expect(ev.seq).toBe(1);
    expect(ev.prevHash).toBe('GENESIS');
  });

  // --------------------------------------------------------------------------
  // T02: Grant P1, P2, P3 independently -> each maintains its own independent state and cv = 1
  // --------------------------------------------------------------------------
  test('T02: Grant P1, P2, P3 independently -> each maintains its own independent state and cv = 1', async () => {
    const userId = `user_T02_${Date.now()}`;

    const r1 = await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: 1 });
    const r2 = await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P2_PERSONALISATION', noticeVersion: 1 });
    const r3 = await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P3_RESEARCH_SHARING', noticeVersion: 1 });

    expect(r1.body.status).toBe('GRANTED');
    expect(r1.body.cv).toBe(1);
    expect(r2.body.status).toBe('GRANTED');
    expect(r2.body.cv).toBe(1);
    expect(r3.body.status).toBe('GRANTED');
    expect(r3.body.cv).toBe(1);

    const getRes = await request(app).get(`/api/consent/${userId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.purposes.P1_ANALYTICS.status).toBe('GRANTED');
    expect(getRes.body.purposes.P1_ANALYTICS.cv).toBe(1);
    expect(getRes.body.purposes.P2_PERSONALISATION.status).toBe('GRANTED');
    expect(getRes.body.purposes.P2_PERSONALISATION.cv).toBe(1);
    expect(getRes.body.purposes.P3_RESEARCH_SHARING.status).toBe('GRANTED');
    expect(getRes.body.purposes.P3_RESEARCH_SHARING.cv).toBe(1);
  });

  // --------------------------------------------------------------------------
  // T03: Grant against stale notice version -> 409 NOTICE_OUTDATED
  // --------------------------------------------------------------------------
  test('T03: Grant against stale notice version -> 409 NOTICE_OUTDATED', async () => {
    const userId = `user_T03_${Date.now()}`;

    const res = await request(app)
      .post('/api/consent/grant')
      .send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: 0 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('NOTICE_OUTDATED');
  });

  // --------------------------------------------------------------------------
  // T04: Valid assertion token + P1 request on PartnerHub -> 200 OK, payload strictly limited to P1 data categories
  // --------------------------------------------------------------------------
  test('T04: Valid assertion token + P1 request on PartnerHub -> 200 OK, payload strictly limited to P1 data categories', async () => {
    const userId = `user_T04_${Date.now()}`;

    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: 1 });

    const assertRes = await request(app)
      .post('/api/assertions')
      .send({ userId, purposeId: 'P1_ANALYTICS' });
    expect(assertRes.status).toBe(200);
    const token = assertRes.body.token;
    expect(token).toBeDefined();

    const hubRes = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', `Bearer ${token}`);

    expect(hubRes.status).toBe(200);
    const data = hubRes.body.data;
    expect(data).toBeDefined();
    // P1 categories only
    expect(data).toHaveProperty('appUsageEvents');
    expect(data).toHaveProperty('sessionCount');
    // Ensure P2 and P3 fields are NOT present
    expect(data).not.toHaveProperty('activitySummary');
    expect(data).not.toHaveProperty('preferences');
    expect(data).not.toHaveProperty('pseudonymisedHeartRate');
    expect(data).not.toHaveProperty('sleepHours');
  });

  // --------------------------------------------------------------------------
  // T05: Request assertion or data with no consent granted -> 403 NO_CONSENT
  // --------------------------------------------------------------------------
  test('T05: Request assertion or data with no consent granted -> 403 NO_CONSENT', async () => {
    const userId = `user_T05_${Date.now()}`;

    const res = await request(app)
      .post('/api/assertions')
      .send({ userId, purposeId: 'P1_ANALYTICS' });

    expect(res.status).toBe(403);
    expect(res.body.reason).toBe('NO_CONSENT');
  });

  // --------------------------------------------------------------------------
  // T06: Withdraw P2 after granting -> 200 WITHDRAWN, cv increments to 2, WITHDRAW event appended
  // --------------------------------------------------------------------------
  test('T06: Withdraw P2 after granting -> 200 WITHDRAWN, cv increments to 2, WITHDRAW event appended', async () => {
    const userId = `user_T06_${Date.now()}`;

    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P2_PERSONALISATION', noticeVersion: 1 });

    const withdrawRes = await request(app)
      .post('/api/consent/withdraw')
      .send({ userId, purposeId: 'P2_PERSONALISATION' });

    expect(withdrawRes.status).toBe(200);
    expect(withdrawRes.body.status).toBe('WITHDRAWN');
    expect(withdrawRes.body.cv).toBe(2);

    const auditRes = await request(app).get(`/api/audit/export/${userId}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.events).toHaveLength(2);
    const ev2 = auditRes.body.events[1];
    expect(ev2.action).toBe('WITHDRAW');
    expect(ev2.purposeId).toBe('P2_PERSONALISATION');
    expect(ev2.cv).toBe(2);
    expect(ev2.seq).toBe(2);
  });

  // --------------------------------------------------------------------------
  // T07: Reuse valid unexpired P2 token immediately after withdrawal -> 403 CONSENT_WITHDRAWN / TOKEN_STALE (instant enforcement)
  // --------------------------------------------------------------------------
  test('T07: Reuse valid unexpired P2 token immediately after withdrawal -> 403 CONSENT_WITHDRAWN / TOKEN_STALE', async () => {
    const userId = `user_T07_${Date.now()}`;

    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P2_PERSONALISATION', noticeVersion: 1 });

    const assertRes = await request(app).post('/api/assertions').send({ userId, purposeId: 'P2_PERSONALISATION' });
    const token = assertRes.body.token;

    // Withdraw P2
    await request(app).post('/api/consent/withdraw').send({ userId, purposeId: 'P2_PERSONALISATION' });

    // Attempt to access PartnerHub using token obtained before withdrawal
    const hubRes = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P2_PERSONALISATION`)
      .set('Authorization', `Bearer ${token}`);

    expect(hubRes.status).toBe(403);
    const reason = hubRes.body.reason || hubRes.body.reasonCode;
    expect(['CONSENT_WITHDRAWN', 'TOKEN_STALE']).toContain(reason);
  });

  // --------------------------------------------------------------------------
  // T08: Withdraw P2 -> P1 and P3 tokens and requests remain completely unaffected (200 OK)
  // --------------------------------------------------------------------------
  test('T08: Withdraw P2 -> P1 and P3 tokens and requests remain completely unaffected (200 OK)', async () => {
    const userId = `user_T08_${Date.now()}`;

    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: 1 });
    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P2_PERSONALISATION', noticeVersion: 1 });
    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P3_RESEARCH_SHARING', noticeVersion: 1 });

    const t1 = (await request(app).post('/api/assertions').send({ userId, purposeId: 'P1_ANALYTICS' })).body.token;
    const t3 = (await request(app).post('/api/assertions').send({ userId, purposeId: 'P3_RESEARCH_SHARING' })).body.token;

    // Withdraw P2
    await request(app).post('/api/consent/withdraw').send({ userId, purposeId: 'P2_PERSONALISATION' });

    // P1 and P3 requests remain unaffected
    const r1 = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', `Bearer ${t1}`);
    expect(r1.status).toBe(200);

    const r3 = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P3_RESEARCH_SHARING`)
      .set('Authorization', `Bearer ${t3}`);
    expect(r3.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // T09: Use a valid P1 token to request P2 data -> 403 PURPOSE_MISMATCH
  // --------------------------------------------------------------------------
  test('T09: Use a valid P1 token to request P2 data -> 403 PURPOSE_MISMATCH', async () => {
    const userId = `user_T09_${Date.now()}`;

    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: 1 });
    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P2_PERSONALISATION', noticeVersion: 1 });

    const assertRes = await request(app).post('/api/assertions').send({ userId, purposeId: 'P1_ANALYTICS' });
    const token = assertRes.body.token;

    // Use P1 token on P2 endpoint
    const hubRes = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P2_PERSONALISATION`)
      .set('Authorization', `Bearer ${token}`);

    expect(hubRes.status).toBe(403);
    const reason = hubRes.body.reason || hubRes.body.reasonCode;
    expect(reason).toBe('PURPOSE_MISMATCH');
  });

  // --------------------------------------------------------------------------
  // T10: Tampered signature or expired JWT -> 401 INVALID_TOKEN
  // --------------------------------------------------------------------------
  test('T10: Tampered signature or expired JWT -> 401 INVALID_TOKEN', async () => {
    const userId = `user_T10_${Date.now()}`;

    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: 1 });
    const assertRes = await request(app).post('/api/assertions').send({ userId, purposeId: 'P1_ANALYTICS' });
    const validToken = assertRes.body.token;

    // Tamper the token by modifying the middle part (payload)
    const parts = validToken.split('.');
    const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    decodedPayload.cv = 999;
    const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const hubRes = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(hubRes.status).toBe(401);
    const reason = hubRes.body.reason || hubRes.body.reasonCode;
    expect(reason).toBe('INVALID_TOKEN');
  });

  // --------------------------------------------------------------------------
  // T11: Publish Notice v2 with material change to P3 only -> P3 returns 403 NOTICE_OUTDATED and flags re-prompt; P1 and P2 remain 200 OK
  // --------------------------------------------------------------------------
  let t11UserId;
  test('T11: Publish Notice v2 with material change to P3 only -> P3 returns 403 NOTICE_OUTDATED and flags re-prompt; P1 and P2 remain 200 OK', async () => {
    t11UserId = `user_T11_${Date.now()}`;

    // Grant all 3 against notice v1
    await request(app).post('/api/consent/grant').send({ userId: t11UserId, purposeId: 'P1_ANALYTICS', noticeVersion: 1 });
    await request(app).post('/api/consent/grant').send({ userId: t11UserId, purposeId: 'P2_PERSONALISATION', noticeVersion: 1 });
    await request(app).post('/api/consent/grant').send({ userId: t11UserId, purposeId: 'P3_RESEARCH_SHARING', noticeVersion: 1 });

    const tokenP1 = (await request(app).post('/api/assertions').send({ userId: t11UserId, purposeId: 'P1_ANALYTICS' })).body.token;
    const tokenP2 = (await request(app).post('/api/assertions').send({ userId: t11UserId, purposeId: 'P2_PERSONALISATION' })).body.token;
    const tokenP3 = (await request(app).post('/api/assertions').send({ userId: t11UserId, purposeId: 'P3_RESEARCH_SHARING' })).body.token;

    // Publish Notice v2: MATERIAL change affecting ONLY P3_RESEARCH_SHARING
    const pubRes = await request(app)
      .post('/api/notices/publish')
      .send({
        changeType: 'MATERIAL',
        affectedPurposes: ['P3_RESEARCH_SHARING'],
        purposes: {
          P3_RESEARCH_SHARING: {
            title: 'Research Sharing (Updated)',
            description: 'Expanded global genetic and heart-rate telemetry research.',
            dataCategories: ['pseudonymisedHeartRate', 'sleepHours', 'genomicMarkers'],
            materialChangeFromPrev: true,
          },
        },
      });
    expect(pubRes.status).toBe(201);
    expect(pubRes.body.version).toBe(2);

    // P3 PartnerHub request should now be rejected with NOTICE_OUTDATED
    const resP3 = await request(app)
      .get(`/api/partnerhub/records?userId=${t11UserId}&purposeId=P3_RESEARCH_SHARING`)
      .set('Authorization', `Bearer ${tokenP3}`);
    expect(resP3.status).toBe(403);
    const reasonP3 = resP3.body.reason || resP3.body.reasonCode;
    expect(reasonP3).toBe('NOTICE_OUTDATED');

    // GET /api/consent/:userId should flag P3 for re-consent
    const consentCheck = await request(app).get(`/api/consent/${t11UserId}`);
    expect(consentCheck.status).toBe(200);
    expect(consentCheck.body.outdatedFlags.P3_RESEARCH_SHARING).toBe(true);
    expect(consentCheck.body.outdatedFlags.P1_ANALYTICS).toBe(false);
    expect(consentCheck.body.outdatedFlags.P2_PERSONALISATION).toBe(false);

    // P1 and P2 remain completely unaffected (200 OK)
    const resP1 = await request(app)
      .get(`/api/partnerhub/records?userId=${t11UserId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', `Bearer ${tokenP1}`);
    expect(resP1.status).toBe(200);

    const resP2 = await request(app)
      .get(`/api/partnerhub/records?userId=${t11UserId}&purposeId=P2_PERSONALISATION`)
      .set('Authorization', `Bearer ${tokenP2}`);
    expect(resP2.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // T12: Re-consent P3 against Notice v2 -> 200 GRANTED, cv incremented, v1 history retained in ledger
  // --------------------------------------------------------------------------
  test('T12: Re-consent P3 against Notice v2 -> 200 GRANTED, cv incremented, v1 history retained in ledger', async () => {
    // Re-consent the user from T11 who experienced the material notice change
    const grantV2Res = await request(app)
      .post('/api/consent/grant')
      .send({ userId: t11UserId, purposeId: 'P3_RESEARCH_SHARING', noticeVersion: 2 });

    expect(grantV2Res.status).toBe(200);
    expect(grantV2Res.body.status).toBe('GRANTED');
    expect(grantV2Res.body.cv).toBe(2); // incremented from 1
    expect(grantV2Res.body.noticeVersion).toBe(2);

    // Ledger must retain v1 history and contain 2 events for P3 (or total events for user)
    const auditRes = await request(app).get(`/api/audit/export/${t11UserId}`);
    expect(auditRes.status).toBe(200);
    const p3Events = auditRes.body.events.filter((e) => e.purposeId === 'P3_RESEARCH_SHARING');
    expect(p3Events).toHaveLength(2);
    expect(p3Events[0].noticeVersion).toBe(1);
    expect(p3Events[1].noticeVersion).toBe(2);

    // Now issue a fresh token for P3 and verify PartnerHub access succeeds (200 OK)
    const newAssertRes = await request(app)
      .post('/api/assertions')
      .send({ userId: t11UserId, purposeId: 'P3_RESEARCH_SHARING' });
    expect(newAssertRes.status).toBe(200);

    const hubRes = await request(app)
      .get(`/api/partnerhub/records?userId=${t11UserId}&purposeId=P3_RESEARCH_SHARING`)
      .set('Authorization', `Bearer ${newAssertRes.body.token}`);
    expect(hubRes.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // T13: Publish Notice update with TYPO_NON_MATERIAL change -> no re-prompt required, existing tokens/consents remain valid (200 OK)
  // --------------------------------------------------------------------------
  test('T13: Publish Notice update with TYPO_NON_MATERIAL change -> no re-prompt required, existing tokens/consents remain valid (200 OK)', async () => {
    const userId = `user_T13_${Date.now()}`;
    const curNotice = await getCurrentNotice();

    // Grant P1 with current notice
    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: curNotice.version });
    const assertRes = await request(app).post('/api/assertions').send({ userId, purposeId: 'P1_ANALYTICS' });
    const token = assertRes.body.token;

    // Publish TYPO_NON_MATERIAL update
    const pubRes = await request(app)
      .post('/api/notices/publish')
      .send({
        changeType: 'TYPO_NON_MATERIAL',
        affectedPurposes: [],
      });
    expect(pubRes.status).toBe(201);

    // Consent check: should NOT flag any purpose as outdated
    const consentRes = await request(app).get(`/api/consent/${userId}`);
    expect(consentRes.body.outdatedFlags.P1_ANALYTICS).toBe(false);

    // Existing token must still be valid for PartnerHub access (200 OK)
    const hubRes = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', `Bearer ${token}`);
    expect(hubRes.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // T14: Grant (cv=1) -> Withdraw (cv=2) -> Re-grant (cv=3): attempting to use the old cv=1 token fails with 403 TOKEN_STALE
  // --------------------------------------------------------------------------
  test('T14: Grant (cv=1) -> Withdraw (cv=2) -> Re-grant (cv=3): attempting to use old cv=1 token fails with 403 TOKEN_STALE', async () => {
    const userId = `user_T14_${Date.now()}`;
    const curNotice = await getCurrentNotice();

    // 1. Grant (cv = 1)
    const g1 = await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: curNotice.version });
    expect(g1.body.cv).toBe(1);

    // Obtain token with cv = 1
    const tokenCv1 = (await request(app).post('/api/assertions').send({ userId, purposeId: 'P1_ANALYTICS' })).body.token;

    // 2. Withdraw (cv = 2)
    const w = await request(app).post('/api/consent/withdraw').send({ userId, purposeId: 'P1_ANALYTICS' });
    expect(w.body.cv).toBe(2);

    // 3. Re-grant (cv = 3)
    const g2 = await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: curNotice.version });
    expect(g2.body.cv).toBe(3);

    // Attempt to access PartnerHub with old token containing cv=1 while live state has cv=3
    const hubRes = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', `Bearer ${tokenCv1}`);

    expect(hubRes.status).toBe(403);
    const reason = hubRes.body.reason || hubRes.body.reasonCode;
    expect(reason).toBe('TOKEN_STALE');
  });

  // --------------------------------------------------------------------------
  // T15: Double withdrawal on the same purpose is handled idempotently without corrupting state or hash chain
  // --------------------------------------------------------------------------
  test('T15: Double withdrawal on the same purpose is handled idempotently without corrupting state or hash chain', async () => {
    const userId = `user_T15_${Date.now()}`;
    const curNotice = await getCurrentNotice();

    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: curNotice.version });

    // First withdrawal
    const w1 = await request(app).post('/api/consent/withdraw').send({ userId, purposeId: 'P1_ANALYTICS' });
    expect(w1.status).toBe(200);
    expect(w1.body.status).toBe('WITHDRAWN');
    expect(w1.body.cv).toBe(2);

    // Second withdrawal (idempotent call)
    const w2 = await request(app).post('/api/consent/withdraw').send({ userId, purposeId: 'P1_ANALYTICS' });
    expect(w2.status).toBe(200);
    expect(w2.body.status).toBe('WITHDRAWN');
    expect(w2.body.cv).toBe(2); // cv unchanged!

    // Ledger should only contain 2 events: 1 GRANT and 1 WITHDRAW
    const auditRes = await request(app).get(`/api/audit/export/${userId}`);
    expect(auditRes.body.events).toHaveLength(2);

    // Chain integrity remains intact
    expect(auditRes.body.chainVerification.chainValid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // T16: Use Alice's valid token to request Bob's data -> 403 SUBJECT_MISMATCH
  // --------------------------------------------------------------------------
  test('T16: Use Alice valid token to request Bob data -> 403 SUBJECT_MISMATCH', async () => {
    const aliceId = `alice_T16_${Date.now()}`;
    const bobId   = `bob_T16_${Date.now()}`;
    const curNotice = await getCurrentNotice();

    await request(app).post('/api/consent/grant').send({ userId: aliceId, purposeId: 'P1_ANALYTICS', noticeVersion: curNotice.version });
    const aliceToken = (await request(app).post('/api/assertions').send({ userId: aliceId, purposeId: 'P1_ANALYTICS' })).body.token;

    // Use Alice's token to query Bob's data
    const hubRes = await request(app)
      .get(`/api/partnerhub/records?userId=${bobId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(hubRes.status).toBe(403);
    const reason = hubRes.body.reason || hubRes.body.reasonCode;
    expect(reason).toBe('SUBJECT_MISMATCH');
  });

  // --------------------------------------------------------------------------
  // T17: Export full audit trail and run verifier -> chainValid: true across the entire lifecycle
  // --------------------------------------------------------------------------
  test('T17: Export full audit trail and run verifier -> chainValid: true across the entire lifecycle', async () => {
    const userId = `user_T17_${Date.now()}`;
    const curNotice = await getCurrentNotice();

    // Sequence of 4 lifecycle actions
    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: curNotice.version });
    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P2_PERSONALISATION', noticeVersion: curNotice.version });
    await request(app).post('/api/consent/withdraw').send({ userId, purposeId: 'P1_ANALYTICS' });
    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: curNotice.version });

    const verifyRes = await request(app).get(`/api/audit/verify/${userId}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.chainValid).toBe(true);
    expect(verifyRes.body.totalEvents).toBe(4);
  });

  // --------------------------------------------------------------------------
  // T18: Modify/tamper an existing event record in consent_events -> verifier returns chainValid: false and identifies firstBrokenSeq
  // --------------------------------------------------------------------------
  test('T18: Modify/tamper an existing event record in consent_events -> verifier returns chainValid: false and identifies firstBrokenSeq', async () => {
    const userId = `user_T18_${Date.now()}`;
    const curNotice = await getCurrentNotice();

    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: curNotice.version });
    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P2_PERSONALISATION', noticeVersion: curNotice.version });

    // Verify chain is valid initially
    const beforeTamper = await request(app).get(`/api/audit/verify/${userId}`);
    expect(beforeTamper.body.chainValid).toBe(true);

    // Tamper seq 1 event's action field
    const tamperRes = await request(app)
      .post(`/api/audit/simulate-tamper/${userId}`)
      .send({ seq: 1, field: 'action', value: 'WITHDRAW' });
    expect(tamperRes.status).toBe(200);
    expect(tamperRes.body.tampered).toBe(true);

    // Run verifier — must detect tampering and flag seq 1
    const afterTamper = await request(app).get(`/api/audit/verify/${userId}`);
    expect(afterTamper.status).toBe(200);
    expect(afterTamper.body.chainValid).toBe(false);
    expect(afterTamper.body.firstBrokenSeq).toBe(1);
  });

  // --------------------------------------------------------------------------
  // T19: Denied requests (401/403) are flushed from async queue and accurately recorded in access_logs
  // --------------------------------------------------------------------------
  test('T19: Denied requests (401/403) are flushed from async queue and accurately recorded in access_logs', async () => {
    const userId = `user_T19_${Date.now()}`;

    // Request with no token -> 401 DENIED
    await request(app).get(`/api/partnerhub/records?userId=${userId}&purposeId=P1_ANALYTICS`);

    // Request with invalid token -> 401 DENIED
    await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', 'Bearer invalid.token.value');

    // Flush async audit queue into MongoDB
    const flushRes = await request(app).post('/api/audit/flush-queue');
    expect(flushRes.status).toBe(200);

    // Inspect access_logs
    const auditRes = await request(app).get(`/api/audit/export/${userId}`);
    expect(auditRes.status).toBe(200);
    const logs = auditRes.body.accessLogs;
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const deniedLogs = logs.filter((l) => l.decision === 'DENIED');
    expect(deniedLogs.length).toBeGreaterThanOrEqual(1);
    expect(deniedLogs[0].reasonCode).toBe('INVALID_TOKEN');
  });

  // --------------------------------------------------------------------------
  // T20: Clear in-memory cache -> middleware seamlessly falls back to MongoDB and produces exact same enforcement decisions
  // --------------------------------------------------------------------------
  test('T20: Clear in-memory cache -> middleware seamlessly falls back to MongoDB and produces exact same enforcement decisions', async () => {
    const userId = `user_T20_${Date.now()}`;
    const curNotice = await getCurrentNotice();

    // 1. Grant consent (populates write-through cache)
    await request(app).post('/api/consent/grant').send({ userId, purposeId: 'P1_ANALYTICS', noticeVersion: curNotice.version });
    const assertRes = await request(app).post('/api/assertions').send({ userId, purposeId: 'P1_ANALYTICS' });
    const token = assertRes.body.token;

    // First request served from cache
    const res1 = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', `Bearer ${token}`);
    expect(res1.status).toBe(200);

    // 2. Clear the entire in-memory cache
    const clearRes = await request(app).post('/api/cache/clear');
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.cleared).toBe(true);

    // 3. Second request must seamlessly fall back to MongoDB, repopulate cache, and produce identical 200 OK
    const res2 = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(200);
    expect(res2.body.data).toEqual(res1.body.data);

    // Third request now served from repopulated cache
    const res3 = await request(app)
      .get(`/api/partnerhub/records?userId=${userId}&purposeId=P1_ANALYTICS`)
      .set('Authorization', `Bearer ${token}`);
    expect(res3.status).toBe(200);
    expect(res3.body.data).toEqual(res1.body.data);
  });

});
