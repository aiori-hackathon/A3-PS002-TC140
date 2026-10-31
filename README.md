# ConsentGuard
## Purpose-Based Consent Recording, Enforcement & Withdrawal Framework
### AIORI Hackathon 3 | Problem Statement: PS-002 | Team Code: `A3-PS002-TC140`

> **Team Name:** No means No  
> **Synthetic Ecosystem:** **FitNest** (Data Fiduciary / Health & Fitness Platform) $\times$ **PartnerHub** (Data Consumer / Analytics & Research Partner)

---

## 🌐 Live Prototype, Videos & Deployment Links



| Service / Resource | Host / Platform | Live Endpoint / URL | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | **Vercel** | [https://consent-guard1.vercel.app/](https://consent-guard1.vercel.app/) | [![Vercel](https://img.shields.io/badge/Vercel-Live-success?logo=vercel)](https://consent-guard1.vercel.app/) |
| **Prototype Demonstration Video** | **YouTube** | [https://youtube.com/shorts/wLrrWsIwlHI?si=RiWp9NLlZWM8PTZA](https://youtu.be/L522hCqwpAI?si=D7ztpNBJC1Civ_c6) | [![YouTube](https://img.shields.io/badge/YouTube-Demo_Video-red?logo=youtube)](https://youtu.be/L522hCqwpAI?si=D7ztpNBJC1Civ_c6) |
| **Team Intro & Pitch Video** | **YouTube** | [https://youtu.be/tLF9r6ZWXj8?si=EnfDShG2fWjaE_ik](https://youtu.be/tLF9r6ZWXj8?si=EnfDShG2fWjaE_ik) | [![YouTube](https://img.shields.io/badge/YouTube-Team_Pitch-red?logo=youtube)](https://youtu.be/tLF9r6ZWXj8?si=EnfDShG2fWjaE_ik) |
| **Backend API Gateway** | **Render** | [https://consentguard-03.onrender.com](https://consentguard-03.onrender.com) | [![Render](https://img.shields.io/badge/Render-Online-success?logo=render)](https://consentguard-03.onrender.com/health) |
| **API Health Check** | **Render** | [https://consentguard-03.onrender.com/health](https://consentguard-03.onrender.com/health) | `{"status":"ok"}` |
| **Database** | **MongoDB Atlas** | `cluster0.r9egch8.mongodb.net/consentguard` | Connected & Encrypted |
| **Source Code** | **GitHub** | [https://github.com/Alizaaa02/ConsentGuard_03](https://github.com/Alizaaa02/ConsentGuard_03) | `main` |

---

## 📌 Project Overview

**ConsentGuard** is an enterprise-grade privacy and purpose-based consent management prototype designed to implement key principles of modern data protection regulations (e.g., India's DPDP Act 2023, DPDP Rules 2025, and GDPR Art. $5$ & $7$). It guarantees that consumer data access is cryptographically bound to explicit user consent, purpose-scoped, tamper-evident, and instantly revocable at request time.

---

## 📑 Table of Contents
- [Live Prototype, Videos & Deployment Links](#-live-prototype-videos--deployment-links)
- [Project Overview](#-project-overview)
- [Problem & Regulatory Alignment](#-problem--regulatory-alignment)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Mentor Deliverable: `enforceConsent` Pseudocode](#-mentor-deliverable-enforceconsent-pseudocode)
- [Project Directory Structure](#-project-directory-structure)
- [Local Development Setup](#-local-development-setup)
- [Database Configuration (MongoDB Atlas & Fallback)](#-database-configuration-mongodb-atlas--fallback)
- [Cloud Deployment (Render & Vercel)](#-cloud-deployment-render--vercel)
- [API Reference](#-api-reference)
- [Cryptographic & Security Design](#-cryptographic--security-design)
- [Automated Lifecycle Test Suite (T01–T20)](#-automated-lifecycle-test-suite-t01t20)
- [Team Members](#-team-members)
- [License & Credits](#-license--credits)

---

## ⚖️ Problem & Regulatory Alignment

Traditional consent workflows suffer from **blanket consent**, **opaque policy updates**, **delayed withdrawal propagation**, and **unverifiable audit logs**. ConsentGuard bridges the gap between legal mandates and real-time enforcement:

| Standard / RFC / Regulation | Core Principle | How ConsentGuard Implements It |
| :--- | :--- | :--- |
| **DPDP Act 2023 (§5–6) & Rules 2025** | Specific, informed consent; withdrawal as easy as granting; log retention | Per-purpose cards, 1-click grant/withdraw, real-time consumer enforcement, and append-only audit logs |
| **GDPR Art. 5(1)(b), Art. 7** | Purpose limitation & demonstrable consent | Independent state machines per purpose (`P1`, `P2`, `P3`) + exportable hash-chained evidence |
| **Kantara Consent Receipt v1.1** | Machine-readable consent record | Ties consent records directly to live API gateway enforcement and a SHA-256 hash chain |
| **ISO/IEC 29184:2020** | Online privacy notices and consent | Versioned notices ($nv$) with incremental re-consent only on affected purposes |
| **RFC 7519 / RFC 8725 (JWT)** | Signed tokens & security best practices | 5-minute ES256 assertion tokens augmented with a live consent-version ($cv$) freshness check |
| **RFC 7009 / RFC 7662** | OAuth token revocation & introspection | Replaces slow network introspection with a $< 5\text{ ms}$ write-through in-memory cache $cv$ check |
| **RFC 6962 / Schneier-Kelsey** | Append-only, tamper-evident audit logs | Per-user SHA-256 hash chain ($\text{hash} = \text{SHA256}(\text{prevHash} + \text{event})$) with an automated verifier endpoint |

---

## 🌟 Key Features

1. **Independent, Purpose-Bound Scopes**:
   - **`P1_ANALYTICS`** (Product Analytics): App usage telemetry, session counters.
   - **`P2_PERSONALISATION`** (Personalised Recommendations): Workout preferences, coaching recommendations.
   - **`P3_RESEARCH_SHARING`** (Biometric Research Sharing): Pseudonymised heart rate, sleep metrics.
   - Granular, independent consent states per user without cross-purpose contamination.

2. **Asymmetric Cryptographic Assertions (ES256 JWT)**:
   - Short-lived (5-minute TTL) JSON Web Tokens signed with Elliptic Curve (P-256) keys.
   - Tokens embed Consent Version ($cv$), Notice Version ($nv$), Subject ID (`sub`), and Purpose ID (`purpose`).
   - Private key signs assertions; public key verifies them without exposing secrets. Supports environment-variable injected keys for cloud platforms.

3. **Instant Revocation via Consent Versioning ($cv$)**:
   - Every grant or withdrawal increments a monotonic counter ($cv$) per user-purpose pair and updates the write-through cache before returning `200 OK`.
   - Any previously issued, unexpired token carrying an older $cv$ is immediately denied (`403 CONSENT_WITHDRAWN` / `TOKEN_STALE`).

4. **Tamper-Evident SHA-256 Hash-Chain Audit Ledger**:
   - Every grant and withdrawal event is cryptographically linked:
     $$\text{hash} = \text{SHA256}(\text{prevHash} + \text{JSON}(\text{eventDetails}))$$
   - Rooted in a deterministic `GENESIS` block for sequence 1.
   - Built-in audit verifier tests mathematical chain continuity and identifies exact sequence tampering.

5. **Dynamic Notice Versioning ($nv$) & Material Change Detection**:
   - Supports notice modifications classified as `INITIAL`, `MATERIAL`, or `TYPO_NON_MATERIAL`.
   - Material changes targeting specific purposes immediately invalidate existing consents (`403 NOTICE_OUTDATED`) and trigger explicit user re-prompts, while unaffected purposes remain active.

6. **Multi-Tier Caching & Asynchronous Audit Queue**:
   - Sub-millisecond ($< 5\text{ ms}$) write-through in-memory cache for ultra-fast consent enforcement lookups.
   - Non-blocking asynchronous logging queue flushes enforcement decisions (`access_logs`) to persistent storage in periodic batches.

7. **Self-Healing Hybrid Database Layer**:
   - **MongoDB Atlas**: Auto-normalizes SRV connection URIs, strips copy-paste errors/line breaks, and URL-encodes special characters in passwords.
   - **Zero-Config In-Memory Fallback**: Spins up embedded `MongoMemoryServer` (MongoDB 7.0.14) automatically if local/remote MongoDB is unreachable during local development.

---

## 🏛 System Architecture

```text
┌─────────────────┐       ES256 Assertion Token      ┌───────────────────────────────┐
│  Data Principal │ ───────────────────────────────▶ │     ConsentGuard Backend      │
│  (alice / bob)  │        (grant / withdraw)        │   (Express.js · Node.js 18+)  │
└─────────────────┘                                  └───────────────┬───────────────┘
                                                                     │
                                      ┌──────────────────────────────┼──────────────────────────────┐
                                      │                              │                              │
                               ┌──────▼──────┐               ┌───────▼────────┐             ┌───────▼────────┐
                               │   notices   │               │ consent_state  │             │ consent_events │
                               │ (versioned) │               │  (fast lookup) │             │ (SHA256 chained│
                               └─────────────┘               └───────┬────────┘             │     ledger)    │
                                                                     │                      └────────────────┘
                                      ┌──────────────────────────────▼──────────────────────────────┐
                                      │              In-Memory Write-Through Cache (Map)            │
                                      └──────────────────────────────┬──────────────────────────────┘
                                                                     │
┌────────────────────────────────────────────────────────────────────▼──────────────────────────────────────────────┐
│                                       enforceConsent Middleware Pipeline                                           │
│  1. Extract Bearer Token  ▶  2. Verify ES256 Signature & Expiry  ▶  3. Match Subject (sub) & Purpose              │
│  4. Load Live Consent State (Cache-first)  ▶  5. Evaluate Notice Freshness  ▶  6. Verify Live CV vs Token CV      │
│  7. Scoped Data Delivery Filter  ▶  8. Asynchronous Batch Audit Queue Log (`access_logs`)                         │
└────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                                     │
                                                         ┌───────────▼───────────┐
                                                         │   PartnerHub Gateway   │
                                                         │ /api/partnerhub/records│
                                                         └───────────────────────┘
```

---

## 💻 Mentor Deliverable: `enforceConsent` Pseudocode

```javascript
async function enforceConsent(req, res, next) {
  // 1. Local cryptographic check (ES256 Public Key, zero network I/O)
  const claims = jwt.verify(token, pubKey, { algorithms: ['ES256'], audience: 'PartnerHub' });
  if (!claims) return deny(res, 401, 'INVALID_TOKEN');

  // 2. Subject & purpose binding check
  if (claims.sub !== req.query.userId) return deny(res, 403, 'SUBJECT_MISMATCH');
  if (claims.purpose !== req.query.purposeId) return deny(res, 403, 'PURPOSE_MISMATCH');

  // 3. Load live consent state: Write-through cache first, fallback to MongoDB
  const key = `${req.query.userId}:${req.query.purposeId}`;
  const state = cache.get(key) ?? await db.consent_state.findOne({ userId, purposeId });

  // 4. Evaluate consent status & notice version freshness
  const decision = decide(state, latestNoticeMeta);
  if (!decision.allow) return deny(res, 403, decision.reason); // NO_CONSENT | CONSENT_WITHDRAWN | NOTICE_OUTDATED

  // 5. Consent Version (cv) freshness check (prevents replay of unexpired tokens post-withdrawal)
  if (claims.cv !== state.cv) return deny(res, 403, 'TOKEN_STALE');

  // 6. Allow request & asynchronously enqueue audit log
  auditQueue.push({ userId, purposeId, decision: 'ALLOWED', httpStatus: 200, reasonCode: 'OK' });
  return next();
}
```

---

## 📂 Project Directory Structure

```text
Consent_Guard1/
├── backend/                             # Express.js Backend Service
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                    # Resilient MongoDB connector (Atlas + MongoMemoryServer)
│   │   │   ├── keys.js                  # EC P-256 keypair loader (env/file/generator)
│   │   │   ├── ec_private.pem           # Generated ECDSA private key
│   │   │   └── ec_public.pem            # Generated ECDSA public key
│   │   ├── middleware/
│   │   │   └── enforceConsent.js        # 6-stage purpose enforcement pipeline
│   │   ├── models/
│   │   │   ├── AccessLog.js             # PartnerHub audit logging schema
│   │   │   ├── ConsentEvent.js          # Tamper-evident hash chain event schema
│   │   │   ├── ConsentState.js          # Live consent status & version schema
│   │   │   └── Notice.js                # Versioned privacy notice schema
│   │   ├── routes/
│   │   │   ├── assertions.js            # JWT assertion generation route
│   │   │   ├── audit.js                 # Ledger export, verification & tamper simulation
│   │   │   ├── cache.js                 # In-memory cache invalidation endpoint
│   │   │   ├── consent.js               # Grant, withdraw & consent status routes
│   │   │   ├── notices.js               # Privacy notice publishing & retrieval routes
│   │   │   └── partnerhub.js            # Purpose-governed data consumption endpoint
│   │   ├── seed/
│   │   │   └── seed.js                  # Idempotent database seeder (Notice v1 & users)
│   │   └── services/
│   │       ├── auditQueue.js            # High-throughput asynchronous audit flush queue
│   │       ├── cacheService.js          # Write-through memory cache
│   │       ├── consentService.js        # Grant/withdraw state machine & decider
│   │       ├── cryptoService.js         # ES256 JWT minting & SHA-256 hash chaining
│   │       └── noticeService.js         # Notice lifecycle & outdatedness engine
│   ├── tests/
│   │   └── lifecycle.test.js            # Comprehensive 20-test automated lifecycle suite
│   ├── .env.example                     # Backend environment variable template
│   ├── package.json                     # Backend dependencies & node --watch script
│   └── server.js                        # Express app entrypoint & lifecycle bootstrap
│
├── frontend/                            # Next.js Dashboard Client
│   ├── components/
│   │   ├── AuditLedger.jsx              # Cryptographic audit ledger & tamper demo UI
│   │   ├── ConsentPortal.jsx            # Data Principal consent manager (grant/withdraw)
│   │   ├── NoticePublisher.jsx          # Admin notice version publisher & material flags
│   │   └── PartnerHubSimulator.jsx      # API Gateway simulation & enforcement tester
│   ├── pages/
│   │   ├── _app.js                      # Next.js application shell
│   │   └── index.js                     # Unified dashboard & real-time health indicator
│   ├── styles/
│   │   └── globals.css                  # Tailwind CSS root styling
│   ├── utils/
│   │   └── api.js                       # Dynamic backend URL resolver (cloud/local/mobile)
│   ├── .env.example                     # Frontend environment variable template
│   ├── next.config.js                   # Next.js compiler settings
│   ├── package.json                     # Frontend dependencies & Next.js scripts
│   └── tailwind.config.js               # Tailwind design system configuration
│
├── .gitignore                           # Excludes node_modules, build outputs, and .env files
├── package.json                         # Root monorepo orchestration scripts
├── render.yaml                          # Render Blueprint specification for backend deployment
└── README.md                            # Complete technical documentation
```

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher (`node -v`)
- **npm**: v9.0.0 or higher (`npm -v`)
- **MongoDB**: *Optional* — If no local MongoDB daemon or Atlas URI is detected, ConsentGuard will automatically run an embedded in-memory database instance.

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/Alizaaa02/ConsentGuard_03.git
cd ConsentGuard_03

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
cd ..
```

### 2. Configure Environment Variables
Create `.env` in `backend/` (or copy from `backend/.env.example`):
```env
# Optional: Set MongoDB Atlas URI or leave blank for embedded MongoDB
MONGODB_URI=mongodb://localhost:27017/consentguard
PORT=4000
JWT_EXPIRES_IN=300
```

Create `.env.local` in `frontend/` (optional for local dev):
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Run the Services

**Option A — Monorepo Convenience Commands (From Root):**
```bash
# Terminal 1: Start Backend (auto-reloads on changes)
npm run backend:dev

# Terminal 2: Start Frontend Dashboard
npm run frontend:dev
```

**Option B — Independent Folders:**
```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

Visit **http://localhost:3000** to access the local dashboard.  
Backend health endpoint is accessible at **http://localhost:4000/health**.

---

## 🗄 Database Configuration (MongoDB Atlas & Fallback)

ConsentGuard features a resilient multi-mode database layer:

### Connecting to MongoDB Atlas
1. Obtain your Atlas connection string:
   `mongodb+srv://<username>:<password>@cluster0.r9egch8.mongodb.net/?retryWrites=true&w=majority`
2. Configure `MONGODB_URI` in `backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.r9egch8.mongodb.net/consentguard?retryWrites=true&w=majority
   ```
3. **Automatic Normalization**:
   - Automatically cleans leading/trailing whitespace, line breaks, and duplicate hosts.
   - Automatically URL-encodes special characters in passwords (e.g., `#`, `@`, `:`, `%`).
   - Automatically masks credentials in console output (`mongodb+srv://user:****@...`).

### Zero-Config Embedded In-Memory Fallback
If `MONGODB_URI` is not set or the local daemon is unreachable:
- ConsentGuard initializes `MongoMemoryServer` (v7.0.14) in-memory.
- Seeds initial privacy notice version 1 automatically.
- Perfect for offline demonstrations, testing, and continuous integration.

---

## ☁️ Cloud Deployment (Render & Vercel)

```text
┌──────────────────────────────────────┐        API Calls (CORS)       ┌──────────────────────────────────────┐
│          Frontend (Vercel)           │ ────────────────────────────▶ │           Backend (Render)           │
│   https://consent-guard1.vercel.app  │                               │ https://consentguard-03.onrender.com │
└──────────────────────────────────────┘                               └──────────────────┬───────────────────┘
                                                                                          │
                                                                       ┌──────────────────▼───────────────────┐
                                                                       │        MongoDB Atlas (Cloud)         │
                                                                       │    0.0.0.0/0 Whitelisted Network     │
                                                                       └──────────────────────────────────────┘
```

### 1. MongoDB Atlas Network Access (Prerequisite)
Since cloud providers (Render, AWS) use dynamic outbound IPs:
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Navigate to **Security** > **Network Access**.
3. Click **Add IP Address** > Select **Allow Access from Anywhere** (`0.0.0.0/0`).
4. Click **Confirm**.

### 2. Backend Deployment on Render
1. Log in to [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Web Service**.
2. Connect your Git repository (`ConsentGuard_03`).
3. Configure service parameters:
   - **Root Directory**: `backend` *(Required)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. In **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | `mongodb+srv://<username>:<password>@cluster0.r9egch8.mongodb.net/consentguard?retryWrites=true&w=majority` |
   | `JWT_EXPIRES_IN` | `300` |
5. In **Advanced**, set **Health Check Path** to `/health`.
6. Click **Create Web Service**.
   - **Live Backend URL**: [https://consentguard-03.onrender.com](https://consentguard-03.onrender.com)
   - **Health Check Endpoint**: [https://consentguard-03.onrender.com/health](https://consentguard-03.onrender.com/health)

*(Note: The repository also contains [`render.yaml`](./render.yaml) for 1-click Blueprint deployment).*

### 3. Frontend Deployment on Vercel
1. Log in to [Vercel](https://vercel.com/) and click **Add New...** > **Project**.
2. Import your Git repository (`ConsentGuard_03`).
3. In **Project Configuration**:
   - **Framework Preset**: `Next.js` (auto-detected).
   - **Root Directory**: Click **Edit** and choose `frontend` *(Required)*.
4. Expand **Environment Variables**:
   | Key | Value |
   | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://consentguard-03.onrender.com` *(Do not add trailing slash)* |
5. Click **Deploy**.
   - **Live Frontend URL**: [https://consent-guard1.vercel.app/](https://consent-guard1.vercel.app/)

---

## 📡 API Reference

### 1. Notices & Privacy Policy
- **`GET /api/notices/current`**: Retrieves the current active privacy notice with all purpose definitions.
- **`POST /api/notices/publish`**: (Admin) Publishes a new notice version.
  ```json
  {
    "changeType": "MATERIAL",
    "affectedPurposes": ["P3_RESEARCH_SHARING"],
    "purposes": { ... }
  }
  ```

### 2. Consent State
- **`GET /api/consent/:userId`**: Returns live consent status (`GRANTED`, `WITHDRAWN`, `NONE`), consent versions ($cv$), and outdated flags for all 3 purposes.
- **`POST /api/consent/grant`**: Grants consent for a specified purpose and notice version.
  ```json
  { "userId": "alice", "purposeId": "P1_ANALYTICS", "noticeVersion": 1 }
  ```
- **`POST /api/consent/withdraw`**: Withdraws consent immediately (increments $cv$, appends to hash chain).
  ```json
  { "userId": "alice", "purposeId": "P1_ANALYTICS" }
  ```

### 3. Assertion Tokens
- **`POST /api/assertions`**: Issues an asymmetric ES256 JWT assertion verifying that consent is currently granted.
  ```json
  { "userId": "alice", "purposeId": "P1_ANALYTICS" }
  ```
  Returns:
  ```json
  {
    "assertionToken": "eyJhbGciOiJFUzI1NiIs...",
    "expiresIn": 300,
    "claims": { "sub": "alice", "purpose": "P1_ANALYTICS", "nv": 1, "cv": 1 }
  }
  ```

### 4. PartnerHub Data Consumption Gateway
- **`GET /api/partnerhub/records?userId=alice&purposeId=P1_ANALYTICS`**:
  - Requires header: `Authorization: Bearer <assertionToken>`
  - Evaluated via `enforceConsent` middleware.
  - Returns purpose-filtered data if valid (`200 OK`), or denies with standard reason codes (`401` / `403`).

### 5. Audit & Ledger Verification
- **`GET /api/audit/export/:userId`**: Exports the entire SHA-256 hash-chained event ledger and access logs.
- **`GET /api/audit/verify/:userId`**: Executes mathematical integrity verification across all blocks in sequence.
  Returns: `{ "chainValid": true, "totalEvents": 4 }`
- **`POST /api/audit/simulate-tamper/:userId`**: Modifies an existing ledger entry in the database to simulate malicious tampering for demonstration.
- **`POST /api/audit/flush-queue`**: Forces an immediate flush of the asynchronous audit queue to database.

### 6. Health & Diagnostics
- **`GET /health`**: Returns `{ "status": "ok" }`.
- **`GET /`**: Returns API metadata and version.

---

## 🔒 Cryptographic & Security Design

### 1. Hash-Chain Event Record
Every consent grant or revocation generates an immutable event record:
```json
{
  "userId": "alice",
  "seq": 2,
  "purposeId": "P1_ANALYTICS",
  "action": "WITHDRAW",
  "noticeVersion": 1,
  "cv": 2,
  "timestamp": "2026-10-28T10:15:30.123Z",
  "prevHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "hash": "7a35c45b89c31149afbf4c8996fb92427ae41e4649b934ca495991b7852bb33"
}
```

### 2. Token Claims (ES256)
```json
{
  "sub": "alice",
  "purpose": "P1_ANALYTICS",
  "nv": 1,
  "cv": 1,
  "iss": "ConsentGuard",
  "aud": "PartnerHub",
  "iat": 1730110000,
  "exp": 1730110300
}
```

### 3. Reason Codes (Denial Diagnostics)
| Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `INVALID_TOKEN` | 401 | Missing, malformed, expired, or invalid ES256 signature |
| `SUBJECT_MISMATCH` | 403 | Token `sub` does not match the requested `userId` |
| `PURPOSE_MISMATCH` | 403 | Token `purpose` does not match the requested `purposeId` |
| `NO_CONSENT` | 403 | No consent record found for the requested purpose |
| `CONSENT_WITHDRAWN` | 403 | Consent was revoked by the user |
| `NOTICE_OUTDATED` | 403 | A material notice revision invalidated the consent version |
| `TOKEN_STALE` | 403 | Token $cv$ does not match live database $cv$ (prevents replay post-withdrawal) |

---

## 🧪 Automated Lifecycle Test Suite (T01–T20)

ConsentGuard features a full 20-test automated lifecycle suite (exceeding the requirement of $\ge 12$ tests) covering all states, transitions, cryptographic verifications, and cache fallback mechanisms.

```bash
# Run tests from root:
npm test
```

### Required Hackathon Demo Path:
`Grant (T01) → Data Sharing (T04) → Withdrawal (T06) → Denied Subsequent Request (T07) → Material Notice Change (T11) → Re-Consent (T12) → Audit Verification (T17)`

| ID | Test Scenario | Expected Outcome |
| :--- | :--- | :--- |
| **T01** | Grant P1 with notice v1 | `200 GRANTED`, $cv=1$, event stored |
| **T02** | Independent purpose isolation (P1, P2, P3) | Three distinct states, each with independent $cv=1$ |
| **T03** | Grant against stale notice version | Rejected with `409 NOTICE_OUTDATED` |
| **T04** | Valid token access to PartnerHub P1 | `200 OK`, delivers strictly scoped telemetry data |
| **T05** | Assertion requested with no consent granted | Rejected with `403 NO_CONSENT` |
| **T06** | Withdraw consent for P2 | `200 WITHDRAWN`, $cv$ increments to 2 |
| **T07** | Replay old token post-withdrawal | Blocked with `403 TOKEN_STALE` |
| **T08** | Withdrawal of P2 leaves P1 and P3 unaffected | P1/P3 tokens continue to return `200 OK` |
| **T09** | Present P1 token to access P2 endpoint | Blocked with `403 PURPOSE_MISMATCH` |
| **T10** | Present tampered/corrupted JWT signature | Blocked with `401 INVALID_TOKEN` |
| **T11** | Material notice update published affecting only P3 | P3 blocked with `403 NOTICE_OUTDATED`; P1/P2 unaffected (`200 OK`) |
| **T12** | Re-consent P3 against notice v2 | `200 GRANTED`, $cv$ incremented, v1 history preserved in ledger |
| **T13** | Non-material typo notice update published | No re-consent required; existing tokens remain `200 OK` |
| **T14** | Re-grant creates $cv=3$; attempt using $cv=1$ token | Blocked with `403 TOKEN_STALE` |
| **T15** | Idempotent double withdrawal on same purpose | Handled cleanly without corrupting state or hash chain |
| **T16** | Cross-tenant exploit (Alice token requesting Bob data) | Blocked with `403 SUBJECT_MISMATCH` |
| **T17** | Full lifecycle audit export and verification | Hash chain verification returns `chainValid: true` |
| **T18** | Simulated event tampering in ledger database | Verifier flags `chainValid: false` and points to exact broken sequence |
| **T19** | Denied requests (401/403) flushed from async queue | Accurately recorded in persistent `access_logs` |
| **T20** | In-memory cache cleared during execution | Middleware seamlessly falls back to MongoDB with exact decisions |

---

## 👥 Team Members

| Name | Role & Focus | Contact |
| :--- | :--- | :--- |
| **Md Samir Khan** | Full-Stack Developer & Backend/Architecture Lead | `md2102172@st.jmi.ac.in` |
| **Aliza Parvez Yousuf** | Frontend UI/UX, Conceptual Design & Pitch Presenter | `alizaparvez45@gmail.com` |

---

## 📄 License & Credits

Submitted as part of Level 1 & Level 2 requirements for **AIORI Hackathon 3** (`A3-PS002-TC140`) | **Team No means No** (FitNest $\times$ PartnerHub Prototype).  
Licensed under the [ISC License](./package.json).
