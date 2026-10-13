[github_project_readme.md](https://github.com/user-attachments/files/33394699/github_project_readme.md)
# ConsentGuard: Purpose-Based Consent Recording & Withdrawal Prototype

> **AIORI Hackathon 3 | Problem Statement:** PS-002 (Purpose-Based Consent Recording & Withdrawal)  
> **Team Name:** No means No  
> **Team Code:** `A3-PS002-TC140`  

---

## 🎥 Team Introduction & Pitch Video

Watch our team introduction and solution walkthrough video below:
* **YouTube Link:** [Watch ConsentGuard Team Introduction & Pitch Video](https://youtu.be/tLF9r6ZWXj8)

---

## 📌 Project Overview
**ConsentGuard** is a purpose-based consent recording and withdrawal prototype built for a synthetic fitness service (*FitNest*). It addresses core privacy gaps in modern applications by ensuring that user consent is strictly tied to specific purposes, policy versions are transparently tracked, and data access is blocked **instantly at request time** rather than waiting for token expiration.

### Core Architecture Highlights:
- **Granular Purpose Control:** Separate consent toggles for independent data purposes ($P1\_ANALYTICS$, $P2\_PERSONALISATION$, $P3\_RESEARCH\_SHARING$).
- **Notice Versioning ($nv$):** Tracks exact policy versions seen by the user; triggers incremental re-prompts only when material changes occur.
- **Instant Revocation via Consent Versioning ($cv$):** Every grant or withdrawal increments a monotonic counter per user-purpose pair, instantly invalidating older signed tokens.
- **High-Performance Enforcement:** Combines short-lived ES256 JWT assertion tokens with an in-memory cache check, targeting **$< 5\text{ ms}$** authorization latency.
- **Tamper-Evident Audit Trail:** Append-only, SHA-256 hash-chained event ledgers ensuring any record alteration is mathematically detectable.

---

## 🏗️ System Architecture & Tech Stack

ConsentGuard is built on a robust **MERN Stack + Mock Downstream Consumer** architecture:
1. **Presentation Tier:** Next.js / React (User Consent Portal & Admin Audit Dashboard)
2. **Application Tier:** Node.js + Express.js REST API (Consent State, Lifecycle Rules, Notice Publishing, Token Issuer)
3. **Enforcement Tier:** PartnerHub (Mock Downstream API protected by custom `enforceConsent` middleware)
4. **Persistence Tier:** MongoDB & Mongoose (`consent_state`, `consent_events`, `notices`, `access_logs`)

---

## 🧪 Lifecycle Testing Suite
We have designed and implemented **20 automated Jest & Supertest lifecycle test cases** (well above the requirement of $\ge 12$) running against `mongodb-memory-server`:
- Verifying successful access grants (200 OK).
- Validating instant access denial upon withdrawal (403( CONSENT WITHDRAWN)).
- Catching stale tokens and outdated notice versions (409)
- Verifying complete SHA-256 hash-chain integrity (`chainValid: true`).

---

## 👥 Team Members
* **Md Samir Khan** — Full-Stack Developer & Backend/Architecture Lead
* **Aliza Parvez Yousuf** — Frontend, Conceptual Design & Pitch Presenter

---
*Submitted as part of Level 1 & Level 2 requirements for AIORI Hackathon 3.*
