# SkillSwap Independent Deep Audit

Date: 2026-08-23

## Executive Summary

The audit covered repository state, both dependency graphs, 36 client routes, 181 Express route declarations, 47 Mongoose models, middleware, service boundaries, sockets, AI adapters, Redux, and 32 baseline suites. No Critical defect was found. High defects were reproduced and fixed across bilateral visibility, realtime presence, booking races, review/message uniqueness, stale database indexes, test isolation, and production error disclosure.

The project is a credible modular monolith, not a production-operated service. The main residual risk is the small crash window between wallet projection mutation and immutable ledger insertion when MongoDB is running as a standalone node. Horizontal Socket.IO delivery, shared rate limiting, malware scanning, and paid checkout remain intentionally unimplemented.

## Critical Findings

None observed in the reviewed code and executed abuse cases.

## High Findings

| Finding | Evidence | Resolution |
| --- | --- | --- |
| Blocked-member disclosure | Cached matches, Explore, user search, direct profiles, mentor recommendations, feed actors/comments, and global presence were not consistently bilateral | Centralized `blockedUserIds`; applied it to every read boundary; presence is now emitted per viewer; operational roles are excluded from mentor results |
| Booking terminal race | `complete`, `cancel`, `no-show`, and dispute used read then save | Terminal changes now use conditional atomic updates. Competing completion/no-show operations have one winner. Dispute creation compensates if the booking claim loses |
| Review uniqueness defect | Unique `(author, swapRequest)` indexed `null`, limiting an author to one canonical review | Replaced with a partial unique legacy index and migration; canonical `(reviewer, session)` remains authoritative |
| Chat replay duplication | A timeout after persistence could make a client retry create a second message | Added UUID `clientMessageId`, a partial unique index, replay response, best-effort notification, and draft restoration on send failure |
| Stale conversation index | A historical unique `participants_1` multikey index limited each user to one conversation even though the current schema was correct | Hardening migration removes the stale unique index and retains the compound participant/time query index; settings privacy proves one owner can have multiple conversations |
| Test database ambiguity | Jest could inherit `server/.env` and point at the development database | Added an early Jest setup file that forces `skillswap_test` unless `TEST_MONGO_URI` is explicit |
| Production error disclosure | Generic 5xx errors returned internal messages in production | Production 5xx responses now return `INTERNAL_ERROR`; logs retain redacted detail and AI status codes are normalized |

## Medium Findings

- Standalone MongoDB cannot atomically commit wallet projection and ledger insert together. Compensation and reconciliation exist, but a process kill in the narrow gap can require operator repair.
- Booking creation reserves slots before the booking insert. The handler cleans up failures, but a process kill can leave orphan reservations. A periodic orphan reconciliation job is still advisable.
- Realtime presence recomputes block visibility in-process. Multiple API instances require a Socket.IO adapter and shared presence store.
- Local document uploads are signature checked but are not malware scanned or quarantined.
- Legacy request/session endpoints remain for compatibility and deep links. They are no longer promoted in primary navigation.

## Low Findings

- Development defaults reference localhost by design.
- Seed and migration scripts log bounded operational output.
- Duplicate `* 2.md` and `upload 2.js` files appear to be prior workspace copies. They were left untouched because the worktree predates this audit and ownership is uncertain.

## UX Findings

- The landing page did not explain paid mentoring or its fail-closed local status.
- The dashboard was a historical metric wall rather than an action surface.
- Chat cleared a draft before persistence was confirmed.
- Compatibility links labeled “Legacy” weakened product realism.

These were corrected without a visual-system redesign.

## Performance Findings

- Route-level lazy loading is effective. The final measured entry bundle is about 246 kB raw / 78 kB gzip.
- Mentor analytics is an isolated 307 kB route chunk because it owns charting; it is not in the entry path.
- A 2,000-user / 20,000-message isolated benchmark found all eight critical query shapes using indexes with sub-1.1 ms local medians. These are warm local measurements, not network SLAs.

## Architecture Findings

- Controllers are generally thin; services own authorization-sensitive transitions.
- MongoDB is authoritative; sockets and AI are delivery/presentation layers.
- Explicit public/private serializers prevent broad user-document leakage.
- `/api` and `/api/v1` deliberately share one router during compatibility migration.

## Data Integrity Findings

- Unique participant/15-minute slots correctly serialize overlapping bookings.
- Credit debits are conditional and idempotency keys serialize duplicate operations.
- Terminal booking state now uses compare-and-set semantics.
- Rescheduling reserves net-new slots before atomically changing the booking version, then releases obsolete slots; a losing concurrent reschedule removes only its token-owned reservations.

## Endpoint Inventory

All declarations were inspected in their mounted middleware context. Route counts: activity 8, admin 23, analytics 3, assistant 2, auth 7, booking 9, career paths 3, certificates 5, challenges 9, chat 5, communities 10, credits 3, dashboard 1, explore 2, group sessions 1, learning 1, listings 8, matches 1, notifications 6, projects 5, proposals 8, reports 1, legacy requests 3, reviews 1, roadmaps 11, safety 11, legacy sessions 4, settings 9, skill gaps 3, skills 5, users 8, and user skills 5. Total: 181 declarations.

Authentication is applied at router scope except intentional public auth, catalog, listing/profile, and certificate verification reads. Zod contracts cap list queries and mutation payloads. Ownership lives in service filters. Admin routes combine authentication, capability checks, and hierarchy checks. Public user output crosses explicit serializers.

## Frontend Route Matrix

The 36 routes were checked for mount, lazy import, guard, and deep-link behavior. Public: landing, login, register, forgot/reset password, certificate verification, listing detail, public profile, and not found. Member protected: onboarding, dashboard, discover, profile, listings, proposals, bookings, credits, assistant, skill gap, roadmaps, learning, communities, group sessions, challenges, certificates, projects, mentor analytics, feed, safety, settings, member profile, compatibility requests/sessions, chat, and notifications. Admin uses both authentication and the admin role guard.

## Fixed During Audit

The audit fixes are covered by focused safety, match, review, chat, booking, credit, and socket tests, the hardening index migration, a deterministic 30-case matching evaluation, a production build, and browser checks against the running alternate-port application.

## Remaining Risks

Use a replica-set transaction path or a durable outbox for fully atomic wallet projection/ledger commits. Add orphan-slot reconciliation, Redis-backed rate limiting/presence, object quarantine and scanning, provider webhooks for paid checkout, and production load/chaos tests before claiming production readiness.
