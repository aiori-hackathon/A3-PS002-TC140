# ConsentGuard
## Purpose-Based Consent Recording & Withdrawal Prototype
### Hackathon Reference: A3-PS002-TC140

> **FitNest** (Data Fiduciary) × **PartnerHub** (Data Consumer)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        MONOREPO STRUCTURE                        │
├──────────────────────────────────────────────────────────────────┤
│  backend/          Node.js · Express · MongoDB · ES256 JWT        │
│  ├── src/                                                        │
│  │   ├── models/         4 Mongoose schemas                      │
│  │   ├── services/       Cache, AuditQueue, Crypto, Consent      │
│  │   ├── routes/         notices, consent, assertions,           │
│  │   │                   partnerhub, audit                       │
│  │   └── middleware/     enforceConsent pipeline                 │
│  └── tests/             20 Jest lifecycle tests (T01-T20)        │
│                                                                   │
│  frontend/         Next.js · React · Tailwind CSS · Lucide Icons  │
│  └── components/                                                  │
│      ├── ConsentPortal.jsx      User grant/withdraw UI           │
│      ├── PartnerHubSimulator.jsx Enforcement playground          │
│      ├── NoticePublisher.jsx    Admin notice management          │
│      └── AuditLedger.jsx        Hash-chain explorer             │
└──────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

```
┌─────────────────┐     ES256 JWT      ┌─────────────────────────┐
│   Data Principal│ ──── grant/withdraw ▶   ConsentGuard Backend   │
│   (alice / bob) │                    │   (Express + MongoDB)    │
└─────────────────┘                    └──────────┬──────────────┘
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          │                       │                       │
                   ┌──────▼──────┐       ┌────────▼───────┐    ┌─────────▼──────┐
                   │   notices   │       │ consent_state  │    │ consent_events │
                   │ (versioned) │       │ (fast-read)    │    │ (hash-chained  │
                   └─────────────┘       └────────────────┘    │  ledger)       │
                                                               └────────────────┘
                                                                       │
                   ┌──────────────────────────────────────────────────┐│
                   │     In-Memory Write-Through Cache (Map)           ││
                   └──────────────────────────────────────────────────┘│
                                                                        │
┌──────────────────────────────────────────────────────────────────────▼──────┐
│                         enforceConsent Middleware Pipeline                   │
│  1. verifyJWT (ES256)  →  2. Subject/Purpose Match  →  3. Load Live State   │
│  4. decide() (status + notice freshness)  →  5. CV Freshness Check          │
│  6. Scoped Data Delivery  →  Async AuditQueue → access_logs                 │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │   PartnerHub Mock API  │
              │   /api/partnerhub/    │
              │   records             │
              └───────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 18+ (macOS / Linux / Windows)
- MongoDB is **OPTIONAL**: If you do not have MongoDB installed or running, ConsentGuard **automatically starts an embedded in-memory MongoDB instance** so you can run and test everything immediately with zero setup! If you do have a local or Atlas MongoDB, simply configure `MONGODB_URI` in `.env`.

### 1. Start Backend Server
```bash
# From repository root:
npm run backend:start
# OR:
cd backend
npm start
# Server starts on http://localhost:4000
# - EC keypair auto-generated on first startup
# - Notice v1 auto-seeded
# - Embedded MongoDB starts automatically if local daemon is not running
```

### 2. Start Frontend Dashboard
```bash
# From repository root:
npm run frontend:dev
# OR:
cd frontend
npm run dev
# Dashboard available at http://localhost:3000
```

### 3. Run All 20 Automated Tests
```bash
# From repository root:
npm test
# Runs all 20 lifecycle tests (T01-T20) in ~1 second
```
# Uses mongodb-memory-server (no external MongoDB needed)
# Tests run sequentially (--runInBand)
```

---

## API Reference

### Notice Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/notices/current` | Latest notice + per-user outdated flags |
| `POST` | `/api/notices/publish` | Publish new notice version (admin) |

### Consent Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/consent/:userId` | All 3 purpose states + flags |
| `POST` | `/api/consent/grant` | Grant consent for a purpose |
| `POST` | `/api/consent/withdraw` | Withdraw consent (idempotent) |

### Assertion Token Issuer
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/assertions` | Issue ES256 JWT (5-min TTL) |

### PartnerHub Mock API
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/partnerhub/records` | Access scoped data (requires Bearer JWT) |

### Audit Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/audit/export/:userId` | Full chain + logs export |
| `GET`  | `/api/audit/verify/:userId` | Chain integrity verification |
| `POST` | `/api/audit/simulate-tamper/:userId` | Demo tamper injection |
| `POST` | `/api/audit/flush-queue` | Flush async audit queue to DB |

### Utility (Testing)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cache/clear` | Clear in-memory cache (T20) |

---

## enforceConsent Middleware — Pseudocode

```
FUNCTION enforceConsent(req, res, next):

  # Step 1: Token Extraction & Crypto Verification
  token = extractBearerToken(req.headers.authorization)
  IF token is missing OR invalid:
    RETURN 401 { reason: "INVALID_TOKEN" }
  
  claims = verifyES256JWT(token)  # checks signature + expiry + aud="PartnerHub"
  IF verification fails:
    logAudit(DENIED, 401, INVALID_TOKEN)
    RETURN 401 { reason: "INVALID_TOKEN" }

  # Step 2: Subject & Purpose Match
  IF claims.sub ≠ req.query.userId:
    logAudit(DENIED, 403, SUBJECT_MISMATCH)
    RETURN 403 { reason: "SUBJECT_MISMATCH" }
  
  IF claims.purpose ≠ req.query.purposeId:
    logAudit(DENIED, 403, PURPOSE_MISMATCH)
    RETURN 403 { reason: "PURPOSE_MISMATCH" }

  # Step 3: Load Live Consent State (Cache-first)
  key = "${userId}:${purposeId}"
  state = cache.get(key)
  IF state is null:
    state = await ConsentState.findOne({ userId, purposeId })
    IF state: cache.set(key, state)  # populate cache

  # Step 4: Status & Notice Freshness Evaluation
  decision = decide(state, latestNotice, purposeId)
  WHERE decide() is:
    IF !state OR state.status == 'NONE'      → { allowed: false, reason: 'NO_CONSENT' }
    IF state.status == 'WITHDRAWN'            → { allowed: false, reason: 'CONSENT_WITHDRAWN' }
    IF isOutdated(purposeId, state.nv, currentNotice):
                                              → { allowed: false, reason: 'NOTICE_OUTDATED' }
    ELSE                                      → { allowed: true }
  
  IF NOT decision.allowed:
    logAudit(DENIED, 403, decision.reason)
    RETURN 403 { reason: decision.reason }

  # Step 5: CV Freshness (Replay / Stale Token Detection)
  IF claims.cv ≠ state.cv:
    logAudit(DENIED, 403, TOKEN_STALE)
    RETURN 403 { reason: "TOKEN_STALE" }

  # Step 6: Scoped Data Delivery
  logAudit(ALLOWED, 200, OK)
  req.consentClaims = claims
  req.liveState = state
  CALL next()  → handler returns data[userId][purposeId] filtered to allowed categories
```

---

## Domain Entities

### Data Principals (Synthetic Users)
| User | P1_ANALYTICS | P2_PERSONALISATION | P3_RESEARCH_SHARING |
|------|-------------|-------------------|---------------------|
| alice | `{ appUsageEvents: [...], sessionCount: 14 }` | `{ activitySummary: "...", preferences: [...] }` | `{ pseudonymisedHeartRate: [...], sleepHours: 7.4 }` |
| bob | Same structure | Same structure | Same structure |

### Three Independent Purposes
| ID | Title | Data Categories |
|----|-------|-----------------|
| `P1_ANALYTICS` | App Analytics | `appUsageEvents`, `sessionCount` |
| `P2_PERSONALISATION` | Personalisation | `activitySummary`, `preferences` |
| `P3_RESEARCH_SHARING` | Research Sharing | `pseudonymisedHeartRate`, `sleepHours` |

### Hash Chain Formula
```
hash = SHA256(prevHash + JSON.stringify({ userId, seq, purposeId, action, noticeVersion, cv, timestamp }))
```
- `seq=1`: `prevHash = "GENESIS"`
- Each subsequent event: `prevHash = previous_event.hash`

---

## 20-Test Lifecycle Suite Summary

| Test | Description | Expected |
|------|-------------|----------|
| T01 | Grant P1 with notice v1 | `200 GRANTED, cv=1` |
| T02 | Grant P1+P2+P3 independently | Each `cv=1`, independent state |
| T03 | Grant with stale notice version | `409 NOTICE_OUTDATED` |
| T04 | Valid token → PartnerHub P1 | `200`, scoped data only |
| T05 | No consent → assertion | `403 NO_CONSENT` |
| T06 | Withdraw P2 after grant | `200 WITHDRAWN, cv=2` |
| T07 | Reuse P2 token after withdrawal | `403 TOKEN_STALE` |
| T08 | Withdraw P2 → P1/P3 unaffected | P1+P3 still `200 OK` |
| T09 | P1 token → P2 data | `403 PURPOSE_MISMATCH` |
| T10 | Tampered JWT | `401 INVALID_TOKEN` |
| T11 | Material notice v2 (P3 only) | P3→`403 NOTICE_OUTDATED`, P1/P2→`200` |
| T12 | Re-consent P3 against v2 | `200 GRANTED, cv++` |
| T13 | Typo/non-material notice | No re-prompt, `200` valid |
| T14 | cv=1 token after cv=3 state | `403 TOKEN_STALE` |
| T15 | Double withdrawal | Idempotent, `cv` unchanged |
| T16 | Alice token → Bob's data | `403 SUBJECT_MISMATCH` |
| T17 | Export + verify chain | `chainValid: true` |
| T18 | Tamper event → verify | `chainValid: false` |
| T19 | Denied requests → access_logs | Flushed and recorded |
| T20 | Clear cache → MongoDB fallback | Same decisions |

---

## Security Design Principles

1. **Cryptographic Non-Repudiation**: Every consent event is SHA-256 hash-chained
2. **Purpose Limitation**: PartnerHub receives ONLY the data categories for the specific consented purpose
3. **Token Staleness Detection**: JWT `cv` claim vs live DB `cv` prevents token replay after withdrawal
4. **Notice Version Enforcement**: Material notice changes invalidate existing consents immediately
5. **Write-Through Cache**: In-memory Map ensures sub-millisecond enforcement reads
6. **Async Audit Queue**: Enforcement decisions are non-blocking, durably logged to `access_logs`
7. **ES256 Asymmetric Signatures**: Private key signs tokens; public key verifies (no shared secret)

---

*Built for Hackathon A3-PS002-TC140 | FitNest × PartnerHub Prototype*
# Consent_Guard1
