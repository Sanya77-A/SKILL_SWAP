# SkillSwap Interview Mastery

## 30-Second Explanation

SkillSwap is a MERN marketplace for exchanging skills, using SkillCredits, or negotiating mentoring terms. It combines explainable matching, conflict-safe booking, a ledger-backed credit economy, relationship-authorized realtime chat, learning evidence, and moderation. MongoDB owns state; Socket.IO and optional AI never own authorization, balances, or scores.

## 2-Minute Explanation

People often have something useful to teach but no trusted path to trade it for what they want to learn. SkillSwap turns that into a complete workflow: professional profiles and verified skills feed deterministic matching; users negotiate versioned proposals; the backend derives booking terms and reserves participant time with unique slot records; chat is unlocked only by a valid relationship; completed sessions unlock structured reviews and learning evidence. SkillCredits handle non-mutual trades through an immutable, idempotent ledger. The application is a domain-oriented React/Express/MongoDB monolith with explicit serializers, Zod validation, HTTP-only rotating auth cookies, capability-based admin authorization, and Socket.IO. AI is provider-neutral and grounded in allowlisted database context, with deterministic fallback. The hardest engineering problems were concurrency and trust boundaries: double booking, double spend/reward, retry-safe messaging, refresh reuse, bilateral blocks, and ensuring AI remains advisory.

## Deep Technical Questions

### Why MongoDB? Why not SQL?

MongoDB fits evolving profile, roadmap, proposal revision, and booking aggregates and matches the existing MERN stack. Unique indexes and atomic conditional updates cover key invariants. SQL would be attractive for stronger cross-aggregate transactions, reporting, and referential integrity. This is a pragmatic fit, not a claim that MongoDB is universally better.

### How does authentication work?

Passwords are hashed. Access and refresh tokens are HTTP-only cookies. Refresh tokens are stored only as hashes, rotated into families, and reuse revokes the family. Protected middleware reloads active account state. CSRF/origin checks protect cookie-authenticated mutations.

### How do sockets remain private?

The handshake authenticates the account. User rooms are identity-scoped. Conversation joins reload membership and relationship permission. Typing and call signals recheck authorization, and presence lists are filtered per viewer for bilateral blocks and privacy settings.

### How do you prevent double booking?

Each participant receives a 15-minute `BookingSlot` record. A unique `(user, slotStart)` index means overlapping concurrent requests cannot both commit. Rescheduling reserves token-owned net-new slots and compare-and-sets booking version/state before releasing old slots.

### How does the SkillCredit ledger prevent double spending?

Debits use an atomic `balance >= amount` predicate and decrement. Every operation and ledger row has a unique idempotency key. Rewards/refunds use booking-derived keys. Reads compare wallet projection to the aggregated immutable ledger.

### What is the remaining wallet risk?

On standalone MongoDB, wallet mutation and ledger insertion are two writes. Compensation covers ordinary errors, but a hard kill between writes can diverge them. A replica-set transaction or durable outbox plus reconciliation closes that gap.

### How does matching work and why deterministic?

Eleven normalized factors with fixed weights produce a bounded score. Core skill fit has the highest weight; reputation and price cannot dominate it. Reasons come from actual factor values. Determinism enables repeatable tests, transparent explanations, and safe debugging.

### How is AI grounded and what happens when it fails?

The context builder allowlists database facts and prompts label context as authoritative data. AI cannot write scores, balances, eligibility, or certificates. JSON is parsed and domain outputs receive schema validation. Timeouts, rate limits, malformed data, or invalid keys normalize to errors while core flows use deterministic fallback.

### How do reviews remain trustworthy?

The server resolves a completed booking, verifies participation, derives the reviewee, and enforces unique reviewer/session. Category ratings are bounded, and reputation is recalculated from eligible persisted reviews.

### How do admin permissions work?

Five role ranks are combined with explicit capabilities. A role mutation additionally enforces target hierarchy: no self-management, equal/higher target changes, or assignment beyond the actor. Mutations create immutable audit records.

### Which indexes matter most?

`BookingSlot(user,slotStart)` for conflicts; booking participant/status/start for calendars; transaction/operation idempotency; message conversation/created and sender/client ID; review reviewer/session; conversation participant sort; listing status/skill/mode; notification user/read/created; match cache user/score.

### What breaks first at scale? Where does Redis help?

In-process Socket.IO presence/rate limits, synchronous match recomputation, regex search, and multi-section Explore. Redis can back Socket.IO pub/sub, distributed presence, shared rate limits, short-lived caches, and job queues. Atlas Search or a search service should own fuzzy discovery.

### How would you add payments?

Introduce provider checkout intents, immutable payment/refund ledgers, verified signed webhooks, idempotency, settlement state, dispute/refund reconciliation, currency/minor-unit rules, and admin audit. Never trust client prices or mark a booking paid from redirect success alone.

### Would you migrate to microservices?

Not yet. Keep domain modules and extract only when team ownership, independent scaling, or reliability boundaries justify operational cost. Likely first candidates are notifications/jobs, search/matching, and realtime gateways. Do not split a small product merely for architectural fashion.

## Code Walkthrough Map

| Domain | Start here | Why |
| --- | --- | --- |
| Auth | `server/src/controllers/authController.js`, `services/accountService.js`, `utils/tokens.js`, `middlewares/auth.js` | Token rotation, account state, authorization context |
| Users/skills | `services/profileService.js`, `services/userSkillService.js`, `serializers/userSerializer.js` | Public/private boundary and canonical skills |
| Matching | `services/matchService.js`, `__tests__/matchEvaluation.test.js` | Pure factors, orchestration, ranking contract |
| Booking | `services/bookingService.js`, `models/BookingSlot.js` | Scheduling and concurrency invariants |
| Wallet | `services/creditService.js`, `models/CreditTransaction.js` | Idempotency, debit, reconciliation |
| Sockets/chat | `socket/index.js`, `services/chatService.js`, `controllers/chatController.js` | Authentication, room/contact checks, retry-safe persistence |
| AI | `services/ai/*`, `services/assistantContextService.js` | Provider boundary, grounding, fallbacks |
| Admin | `routes/adminRoutes.js`, `middlewares/role.js`, `controllers/adminController.js` | Capability and hierarchy enforcement |

## Practice Tasks

1. Change one match weight, keep the total 100, update ordering tests, and explain the product effect.
2. Add one booking validation in the validator and service, then test a stale and malicious client.
3. Add a SkillCredit transaction type with direction, idempotency, notification, and reconciliation tests.
4. Add an AI provider adapter without changing controllers; test timeout, error shape, empty output, and usage mapping.
5. Add a notification type through model taxonomy, preferences, safe link, delivery, and UI filter.
6. Add a profile preference through private model, validator, serializer decision, settings UI, and match behavior.
7. Trace one chat send from form to thunk, HTTP validation, message index, conversation projection, notification, room emit, reducer, and read receipt.
