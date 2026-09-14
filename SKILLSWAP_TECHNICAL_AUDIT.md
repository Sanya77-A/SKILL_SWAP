# SkillSwap Technical Audit

Date: 2026-08-22
Audit scope: complete tracked application source, configuration, documentation, production client build, backend test suite, and a read-only browser pass at desktop and 430px mobile width.

## Executive Summary

SkillSwap is a functional MERN proof of concept, not yet a production marketplace. Its strongest foundations are the existing React/Redux client, Express/Mongoose API, cookie-capable JWT flow, deterministic match service, Socket.IO chat, swap requests, basic sessions, reviews, notifications, admin reporting, and reusable UI primitives. Those systems should be evolved rather than replaced.

The main architectural gap is that the data model still represents a simple peer-to-peer swap application. Skills are strings on users, sessions are unvalidated strings, reviews are attached to swaps rather than completed bookings, and there are no listings, wallets, ledgers, normalized skills, availability rules, payments, communities, learning plans, or provider-based AI services. Several security controls are present but undermined by known fallback JWT secrets, raw refresh tokens, browser `localStorage` access tokens, incomplete request validation, weak WebSocket authorization, and CI that suppresses failures.

The recommended path is an incremental modular monolith: keep React, Express, MongoDB, Mongoose, Redux Toolkit, Socket.IO, Zod, and the current route slugs; add versioned API aliases, domain services, normalized marketplace models, transactional credit operations, and compatibility adapters. Avoid a Next.js or TypeScript rewrite until the product domain and critical flows are stable.

## Audit Method and Baseline

- Inspected 69 files under `client/src` and 61 files under `server/src`.
- Inspected all models, routes, controllers, services, middleware, validators, tests, environment examples, CI, Docker, deployment configuration, and active client routes.
- Ran the production Vite build successfully. Output: 2,568 transformed modules, 786.16 kB main JavaScript chunk (236.59 kB gzip), with a chunk-size warning.
- Ran the backend suite successfully: 3 suites, 7 tests, 0 failures.
- Browser-tested the public homepage and login route on the running 5174/5003 instance.
- Verified the homepage at 430px: document width equals viewport width and no horizontal overflow was present.
- External npm advisory lookup was blocked because it would transmit dependency metadata. Offline npm cache reported no known production advisories, but this is not equivalent to a current registry audit. A preceding client install reported 15 advisories across all dependency classes (1 low, 6 moderate, 8 high), which must be rechecked in an explicitly authorized environment.
- The working tree already contained a client lockfile modification caused by repairing the missing macOS ARM Rollup optional dependency required to start the application.

## Current Architecture

### Repository layout

The actual Git root is the nested `skillswap/` directory. The containing workspace directory is not a Git repository. This causes easy command-path mistakes and should be documented or flattened later with care.

### Frontend

- React 18 single-page application built by Vite 5.
- JavaScript and JSX, not TypeScript.
- React Router 6 with a single `AppShell` layout and protected routes.
- Redux Toolkit slices for auth, users, matches, requests, sessions, chat, notifications, dashboard, analytics, reports, and admin.
- Axios client with cookies, bearer-token injection, and a refresh/retry interceptor.
- Tailwind CSS 3 with CSS-variable light/dark tokens.
- React Hook Form is used on auth/profile surfaces; Zod is used client-side on some auth forms but not consistently.
- Socket.IO client supports presence, messages, typing, signaling, and calls.
- Recharts and Chart.js are both installed, though active screens primarily use Recharts.

Active route tree:

| Route | Access | Active screen |
| --- | --- | --- |
| `/` | Public | Home |
| `/login` | Public | Login |
| `/register` | Public | Registration |
| `/forgot-password` | Public | Password reset request |
| `/reset-password` | Public | Password reset completion |
| `/onboarding` | Authenticated | Minimal one-step skills form |
| `/dashboard` | Authenticated | Swap metrics and suggested matches |
| `/discover` | Authenticated | Matches and user search |
| `/profile` | Authenticated | Profile editing |
| `/user/:id` | Authenticated | User profile, report, swap request, reviews |
| `/requests` | Authenticated | Incoming/outgoing swaps |
| `/sessions` | Authenticated | Basic session proposals |
| `/chat` | Authenticated | Conversations, attachments, calling |
| `/notifications` | Authenticated | Notification center |
| `/admin/*` | Admin | Users, reports, and platform statistics |

### Backend

- Node.js ESM application with Express 4.
- MongoDB through Mongoose 8.
- REST endpoints mounted under `/api` without API versioning.
- JWT access and refresh tokens; cookies plus optional bearer token support.
- Refresh-token persistence and rotation through MongoDB.
- Socket.IO for presence, chat-related events, and WebRTC signaling.
- Multer with local storage and optional Cloudinary upload.
- Nodemailer with optional SMTP.
- Helmet, CORS, rate limiting on auth routes, `express-mongo-sanitize`, and `xss-clean`.
- Thin controller/service split. Matching and notifications have services; most booking, wallet, review, auth, and admin rules remain in controllers.

### Database

Current collections/models:

- `User`
- `SwapRequest`
- `Session`
- `Review`
- `Conversation`
- `Message`
- `Notification`
- `RefreshToken`
- `MatchCache`
- `Report`

Skills are embedded as strings in `User.skillsOffered` and `User.skillsWanted`. There is no canonical `Skill`, `UserSkill`, listing, availability, booking, wallet, transaction, payment, learning, community, certificate, achievement, verification, dispute, or moderation workflow model.

### Runtime and deployment

- Local Vite defaults to port 5173 and proxies API/WebSocket traffic to port 5002.
- `server/.env` currently declares port 5002.
- Docker declares server port 5000 and client port 80.
- README still advertises API port 5000 in several places, so local documentation is inconsistent.
- Render configuration only declares `NODE_ENV`; required production secrets and URLs are not enumerated there.
- CI uses Node 20 and MongoDB 7.

## Existing Features

- Registration, login, refresh, logout, forgot password, and password reset.
- Profile editing with optional profile-image upload.
- User search with basic filters and pagination.
- Deterministic recommended-match calculation and cache.
- Swap request creation, acceptance, rejection, cancellation, and completion.
- Conversation creation after an accepted/completed swap.
- One-to-one persisted messages, presence, typing events, images/PDF attachments, read state, and unread counters.
- Audio/video calling through browser WebRTC signaling.
- Basic session proposal, slot acceptance, completion, and listing.
- Review creation after a completed swap, uniqueness per author/swap, and rating aggregation.
- Persisted notifications with unread count and real-time events.
- User and platform analytics derived from database queries.
- User reporting plus basic admin list/block/unblock/soft-delete operations.
- Dark/light theme, reusable UI components, desktop sidebar, mobile bottom navigation, loading skeletons on selected screens, and toast feedback.
- Docker, CI, seed script, architecture/security/scaling documentation, and 7 backend tests.

## Working Features

The following are verified by tests, build output, runtime inspection, or direct code-path evidence:

- The production client compiles successfully.
- All 7 existing Jest tests pass against MongoDB.
- Registration returns a user and auth cookies in the test suite.
- Invalid login returns a generic 401 response.
- Auth middleware rejects unauthenticated swap creation.
- Authenticated swap creation succeeds in the existing test flow.
- Match scoring detects mutual skills, high ratings, and availability overlap.
- The Express health endpoint responds on the running backend.
- MongoDB connects successfully on the running backend.
- Public homepage and login UI render at desktop and 430px.
- The homepage has no 430px horizontal overflow.
- The active dashboard, discovery, admin analytics, and notification counts query backend data instead of presenting static fake values.
- Review eligibility checks participation and completed swap state, and a unique index prevents duplicate author/swap reviews.
- Chat REST reads enforce conversation participation.

## Broken Features

### Confirmed runtime or code defects

- README demo credentials did not authenticate against the current local database. The seed script must be run before those credentials are valid, and documentation should state that more prominently.
- On public mobile routes, the top bar displays an "Open menu" button even though `Sidebar` returns nothing for unauthenticated users. Clicking it produces an empty drawer/overlay state.
- Auth and request Redux loading matchers compare action-creator functions to `action.type` strings. These matchers never fire, so submit/loading states are unreliable.
- The onboarding screen claims multi-step state but implements only one step, does not persist partial progress, uses non-existent `primary-*` Tailwind classes, and dispatches a synthetic fulfilled action without updating the authenticated user.
- The active layout wraps public marketing/auth pages in the application shell, producing an empty desktop rail area and a blank-looking top region instead of intentional public navigation.
- The `Button` `asChild` implementation overwrites a child link's existing `className` instead of merging it.
- Breadcrumb markup maps each item to its own `flex` container, so multiple crumbs do not form one continuous row.
- The browser console emits React Router v7 migration warnings because future flags are not configured.
- The npm command wrappers in the extracted repository lack executable bits. `npm run dev` and normal Vite/Nodemon scripts fail with `Permission denied` unless the JavaScript entry points are called directly or permissions are repaired.

### Functionally incomplete core flows

- Sessions accept arbitrary strings such as "Mon 10am" rather than validated timestamps. There is no timezone conversion, duration, delivery mode, conflict detection, reschedule, cancellation, reminder, no-show, dispute, or attendance state.
- A swap can be marked complete directly without a completed session or dual confirmation.
- WebRTC provides signaling only. There is no session-bound authorization, TURN service ownership, consent/status record, timer, notes, or issue workflow.
- Message delivery/read behavior is partial. REST-posted messages emit to the user room, while conversation-room membership and typing are handled separately. There is no delivered status and attachment cleanup is incomplete.
- Search is user-only, regex-based, and not debounced. There are no skill/listing/community/group-session result types.
- Match filters and score display are rudimentary; the raw score is not normalized or explained as a bounded percentage.
- Password reset does not revoke existing refresh tokens.
- Email verification is represented by a field but has no send/verify flow.
- Admin reports have no lifecycle, assignment, evidence, decision, or audit log.

## Missing Features

The following product domains from the target brief do not exist yet:

- Canonical skills, categories, aliases, user skill proficiency, evidence, certification, endorsements, and verification.
- Mentor/service listings and free, credit, paid, or hybrid pricing.
- SkillCredit wallet, immutable ledger, idempotency keys, reservations, refunds, and transaction-safe balance updates.
- Production booking/calendar domain with availability rules and conflict prevention.
- Counter-offers, proposal versions, expiry, offered/requested session counts, and hybrid settlement.
- Professional profile fields, profile strength, reputation levels, SkillScore, achievements, public `@username` portfolio, and privacy settings.
- Favorites, saved listings, recent searches, and recently viewed mentors.
- Communities, posts, comments, follows, group sessions, challenges, and activity feed.
- Learning roadmaps, milestones, progress, goals, resources, certificates, and verification routes.
- AI provider abstraction, database context builder, skill-gap analysis, mentor recommendations, and learning-plan generation.
- Payment intent/provider abstraction and revenue/refund records.
- Block-user graph, message/listing/review reports, disputes, suspensions, moderation roles, and admin audit trail.
- Global search, SEO metadata for public entities, OpenGraph, canonical URLs, and sitemap rules.
- Notification preferences, push/email channel preferences, and reminder scheduling.

## Technical Debt

- Two frontend implementations coexist. The active `*Page.jsx`/Redux route set is accompanied by unused legacy pages (`Landing.jsx`, `Login.jsx`, `Register.jsx`, `Dashboard.jsx`, `Matches.jsx`, `Profile.jsx`, `Search.jsx`, `SwapRequests.jsx`, `Chat.jsx`, `UserProfile.jsx`), unused `Navbar.jsx`, and legacy `AuthContext`/`SocketContext` consumers. This increases cognitive load and regression risk.
- README incorrectly calls the React SPA "server-rendered."
- README, Vite, Docker, and `.env.example` disagree on the normal API port.
- No lint scripts exist, while CI pretends to run lint.
- The client ships a single 786.16 kB minified JavaScript chunk. Routes and heavy charts/video code are not lazy-loaded.
- Both Chart.js and Recharts are dependencies, suggesting overlapping visualization stacks.
- API error handling and slice loading/error handling are inconsistent.
- Controllers contain state-machine logic, side effects, notification creation, email sending, and persistence in the same function.
- Dynamic `import()` is used in request acceptance to create conversations without awaiting completion. Failures are intentionally swallowed.
- Magic strings for statuses, notification types, permissions, paths, and match weights are spread across layers.
- Several user-visible strings contain legacy em/en dashes and decorative symbols. Copy, status naming, and capitalization are inconsistent.
- Current design tokens use an AI-default violet accent, Inter body font, glow-like hero blobs, and repeated equal-card layouts. The UI is coherent but generic and does not yet express a differentiated skill economy brand.
- The repository contains `.DS_Store` files and a zero-byte `readmd` file.
- File modes are broadly writable and executable bits for package binaries are missing, indicating archive/extraction damage.

## Security Issues

Severity reflects production risk, not exploit confirmation.

### Critical

- `tokens.js` and Socket.IO silently fall back to known JWT secrets (`access-secret-change-me`, `refresh-secret-change-me`). Startup must fail outside tests when secrets are absent or weak.
- `dotenv.config()` executes in `server.js` after imported modules have already evaluated. Locally loaded `.env` values are therefore unavailable to module-level JWT secrets, socket secrets, cookie options, CORS origins, Cloudinary initialization, and email defaults. Platform-injected process variables work, but local `.env` behavior is misleading and can cause tokens to use fallback secrets.

### High

- Access tokens are returned in JSON and persisted in `localStorage`, defeating much of the XSS protection offered by HTTP-only cookies. The architecture should choose cookie-only browser auth and keep bearer support for explicit non-browser clients.
- Refresh tokens are stored raw in MongoDB. A database read compromise exposes active session credentials. Store token hashes and metadata instead.
- Socket.IO allows any authenticated user to join any `conv:<id>` room without verifying conversation membership. Typing events can therefore be observed or injected across conversations if an ID is known.
- WebRTC signaling accepts arbitrary `to` user IDs and is not bound to an accepted swap or confirmed session, enabling authenticated call spam and signaling abuse.
- Cookie auth uses `SameSite=None` in production without a CSRF token or strict origin check for state-changing requests. CORS alone is not a complete CSRF control.

### Medium

- Many routes lack Zod validation, including sessions, reports, admin IDs/queries, chat conversation creation, notifications, dashboard, analytics, and match query parameters.
- Password policy allows six-character passwords and there is no account lockout/backoff beyond a shared IP rate limit.
- Password reset does not revoke refresh tokens or invalidate all sessions.
- User search accepts an unescaped regex and user-controlled sort field. Apply regex escaping, length limits, and a sort allowlist.
- File validation relies on extension and MIME claims, not file signatures. Local uploads are publicly served from a predictable route.
- Cloudinary upload failure paths can leave temporary files behind.
- Admin can block/delete arbitrary users, potentially including self or other privileged users, with no hierarchy or audit log.
- Report creation has no body/ID validation, duplicate prevention, target status check, or abuse throttling.
- Legacy `xss-clean` should not be treated as a substitute for output encoding and field-level sanitization.
- Error logging accepts arbitrary messages/stacks and lacks request IDs or structured redaction rules.

### Positive controls already present

- Bcrypt cost 12.
- Short access-token lifetime and refresh rotation.
- HTTP-only cookie support.
- Generic invalid-login response.
- Soft deletion and blocked-user checks in auth middleware.
- Helmet, explicit CORS allowlist, request body size limits, Mongo sanitization, and auth rate limiting.
- Ownership/participant checks on REST chat, swaps, sessions, reviews, and notification updates.

## UX Problems

- Public pages and authenticated product pages share one shell even though their navigation needs differ.
- The homepage communicates only direct barter, contradicting the requested three-model economy.
- No realistic marketplace imagery, mentor identity, skill taxonomy, listing cards, trust markers, or social proof exists.
- Desktop navigation omits requested destinations such as mentors, communities, bookings, learning, and wallet.
- Mobile navigation contains six destinations in a tight bottom bar and lacks an intentional "more" pattern.
- Profile editing uses comma-separated skill text instead of structured, validated skill selection.
- Empty states are mostly plain sentences. Error states often disappear into Redux state or rely only on toasts.
- Several async screens do not show skeletons, retry actions, or button-level progress.
- Destructive admin actions use `window.confirm` instead of an accessible confirmation dialog.
- Profile image URLs are normalized inconsistently between screens.
- Ratings render as zero rather than a clear "New" state.
- Discovery exposes a raw match number without factor breakdown, strengths, conflicts, or recommendation.
- Accessibility foundations exist, but modal focus management, dropdown escape behavior, menu keyboard behavior, call controls, form helper/error association, and screen-reader announcements require a full audit.
- Public pages lack a meta description and route-specific titles. Private/public indexing rules are absent.

## Database Problems

- Skills as case-sensitive strings create duplicates and weak querying. Matching mixes exact `$in` filters with later substring scoring, producing inconsistent candidates.
- User profile fields are too shallow for marketplace identity, verification, privacy, and professional proof.
- `Session` is not a booking model: it has no actual date type, duration, mode, timezone, status history, cancellation policy, or conflict index.
- `Session.requestId` is indexed but not unique. The controller's check-then-create flow is race-prone and can create duplicates concurrently.
- `Conversation` has no stable participant-key unique constraint. Startup actively drops the `participants_1` index, while controller error handling expects a duplicate-key race guard that can no longer occur.
- `RefreshToken.token` stores a secret directly.
- `Review` lacks structured rating categories and is linked to `SwapRequest`, not a completed booking/session.
- `Report` supports only reported users and a reason; it lacks target type, category, evidence, status, assignee, decision, and timestamps for moderation.
- `MatchCache` has no expiry and recomputation only upserts current candidates; stale matches are not removed.
- `lastActiveAt` is initialized but not updated during auth, API, or socket activity.
- Notification types are too narrow for emitted and planned events.
- No transactional ledger exists for credits, and no MongoDB transaction strategy is documented for sensitive workflows.
- Several high-cardinality/pagination queries need compound indexes aligned to actual filter and sort patterns.

## API Problems

- No `/api/v1` namespace or compatibility strategy.
- Response envelopes vary between `{ user }`, `{ request }`, `{ stats }`, top-level analytics fields, and `{ data, pagination }`.
- Errors lack stable machine-readable codes and structured details.
- Pagination metadata uses `pagination` instead of the target `meta` convention and is not applied consistently.
- Query, params, and body validation is incomplete.
- State transitions are action strings on generic `PATCH /requests/:id` instead of explicit, auditable domain commands or a strict transition service.
- No idempotency support exists for proposal, booking, completion, payment, wallet, or notification-producing operations.
- Side effects are not atomic. A request may be accepted while conversation/email/notification creation fails independently.
- No service boundary exists for booking, reputation, wallet, verification, moderation, or AI.
- No API documentation is generated or tested against handlers.
- `/api/users/:id` is private-only, so no public portfolio route exists.

## Existing Test Coverage

Current automated coverage consists of 7 backend tests:

- Registration success.
- Invalid login.
- Swap auth requirement.
- Swap creation happy path.
- Three match-score factors.

Weaknesses:

- The swap creation test conditionally asserts only if the response is 201, so an unexpected failure status can still pass.
- Auth cleanup regex does not match the generated registration email pattern, which can leave test users behind.
- Request cleanup deletes every swap in the test database instead of only fixtures created by that test.
- No isolated database lifecycle or `mongodb-memory-server` setup exists.
- No frontend component tests, accessibility tests, integration tests, or E2E tests exist.
- No tests cover refresh reuse, logout, password reset, authorization boundaries, blocked users, upload validation, chat membership, socket rooms, duplicate sessions, invalid/past slots, concurrent requests, reviews, notifications, admin hierarchy, or error envelopes.
- CI suppresses server lint, tests, and import/build failures using `|| true`, so the server job can report success when validation fails.

## Recommended Architecture

### Architectural style

Keep a modular monolith until real scaling pressure appears. Organize the server by domain while retaining Express and Mongoose:

```text
server/src/
  config/
  platform/          # errors, response envelope, logging, auth, idempotency
  domains/
    identity/
    skills/
    listings/
    matching/
    proposals/
    bookings/
    messaging/
    reviews/
    reputation/
    wallet/
    notifications/
    learning/
    communities/
    moderation/
    ai/
  app.js
  server.js
```

Each domain should expose schemas, models, repositories/query helpers, services containing invariants, controllers, and routes. Cross-domain events should initially use an in-process outbox/event service backed by MongoDB, not a new message-broker dependency.

### API evolution

- Introduce `/api/v1` routes while keeping current `/api/*` mounts as compatibility aliases during migration.
- Standardize success as `{ success, data, message, meta }` and errors as `{ success: false, error: { code, message, details }, requestId }`.
- Add strict Zod schemas for body, params, and query on every route.
- Add stable domain error classes and transition services.
- Add idempotency keys and MongoDB transactions for credit, booking, payment, refund, and completion operations.

### Authentication and security

- Load and validate environment configuration before importing application modules.
- Remove production secret fallbacks and enforce minimum secret entropy.
- Use HTTP-only secure cookies for the browser; remove access-token `localStorage` persistence and token JSON fields from browser auth responses.
- Hash refresh tokens, track session metadata, detect reuse, and support revoke-one/revoke-all.
- Add CSRF protection for cross-site cookie deployments.
- Authorize every Socket.IO room/event against database relationships.
- Add account security events, password reset revocation, email verification, and role hierarchy (`user`, `mentor`, `moderator`, `admin`, `super_admin`).

### Core data model

Add in dependency order:

1. `Skill`, `SkillCategory`, `UserSkill`, `AvailabilityRule`.
2. `Listing`, `SavedListing`.
3. `SwapProposal` with offer versions and expiry.
4. `Booking` with UTC start/end, timezone, status history, participant indexes, and conflict checks.
5. `Wallet` and immutable `CreditTransaction` with idempotency keys and `balanceAfter`.
6. Structured `Review`, `ReputationSnapshot`, `VerificationRequest`, `AchievementGrant`.
7. `Roadmap`, `RoadmapMilestone`, `LearningProgress`, `Certificate`.
8. `Community`, `CommunityMembership`, `CommunityPost`, `GroupSession`, `Challenge`.
9. `Dispute`, generalized `Report`, `ModerationAction`, `AuditLog`.

Do not delete legacy string skills or current swap/session fields immediately. Backfill canonical references and maintain read adapters until migration is verified.

### Frontend architecture

- Keep React/Vite and route slugs for now.
- Separate `PublicShell`, `AuthShell`, and `ProductShell`.
- Lazy-load routes and heavy chart/call modules.
- Retain Redux Toolkit for server-backed domain state, but standardize thunk lifecycle and selectors.
- Build accessible product primitives and domain cards (`MentorCard`, `ListingCard`, `MatchCard`, `BookingCard`, `WalletActivity`).
- Use one calm, dual-mode token system with a single distinctive accent, 12-16px card radius, strong focus states, and restrained motion.
- Treat the design as redesign-preserve: retain the SkillSwap name and core IA until an explicit navigation migration, but retire the generic violet glow, equal-card repetition, and comma-separated skill forms.

### AI architecture

AI should be added only after normalized skills, profiles, listings, and learning data exist. Use a provider interface with intent routing, deterministic context building, structured schemas, prompt versioning, cost/latency logging, and a no-critical-mutation rule. Match scores remain deterministic; AI may explain them but never invent the score.

## Implementation Roadmap

### Phase 0: audit and baseline

- Complete this audit.
- Repair executable file modes and root-path documentation.
- Preserve a clean baseline build/test record.

### Phase 1: architecture cleanup

- Load validated environment configuration before app imports.
- Add shared constants, error classes, response helpers, request IDs, and structured logs.
- Add `/api/v1` aliases without breaking current clients.
- Remove or archive confirmed legacy frontend files after import verification.
- Split public, auth, and product shells; enable route lazy loading.
- Make CI failures real and add lint scripts.

### Phase 2: authentication and security

- Cookie-only browser auth, hashed refresh sessions, secret validation, CSRF strategy, reset revocation, email verification, account backoff, socket authorization, and security tests.

### Phase 3: marketplace data foundation

- Canonical skills, user skills, professional profile fields, availability, privacy, verification, indexes, migrations, and realistic seed data.

### Phase 4: professional profiles

- Profile completeness service, public username routes, portfolio/evidence, reviews, metrics, verification badges, settings, and responsive profile UX.

### Phase 5: skills and listings

- Listings with outcomes, prerequisites, modes, durations, skill swap/credit/paid/hybrid pricing, mentor controls, filters, and tests.

### Phase 6: explore and search

- Unified search, aliases, category filters, pagination, sorting, saved/recent state, discovery ranking, and accessible loading/error/empty states.

### Phase 7: deterministic matching

- Separate factor functions, normalized 0-100 score, factor breakdown, conflicts, reasons, cache invalidation, and comprehensive unit tests.

### Phases 8-13: transaction workflows

- Versioned proposals and counters.
- Booking/calendar with UTC storage, timezone display, availability and conflict protection.
- Session-bound messaging/calling.
- Structured reviews and transparent reputation.
- SkillCredit wallet and immutable ledger with transaction/idempotency tests.
- Notification preferences and reminders.

### Phases 14-17: AI and learning

- Provider abstraction after real context exists.
- Skill-gap analysis, roadmaps, milestones, progress, resources, and safe recommendation actions.

### Phases 18-25: network, trust, and operations

- Communities, group sessions, challenges, certificates, public portfolio expansion, mentor analytics, role-aware admin, blocks/reports/disputes, and moderation audit logs.

### Phases 26-30: production readiness

- Responsive matrix at 1440, 1280, 1024, 768, 430, and 390px.
- WCAG keyboard/screen-reader/contrast/reduced-motion verification.
- Query/index profiling, image optimization, code splitting, and cache policy.
- Backend unit/integration/concurrency tests plus critical browser E2E flows.
- Current online dependency audit with explicit authorization, threat model, deployment runbook, backups, observability, and final production audit.

## Immediate Priority Order

1. Fix environment loading and eliminate default JWT secrets.
2. Remove browser `localStorage` token persistence and harden refresh sessions.
3. Enforce Socket.IO room/event authorization.
4. Make CI tests fail correctly and fix the false-positive request test.
5. Add complete validation and stable error envelopes.
6. Normalize skills and professional profile data while preserving legacy fields.
7. Build listings, proposals, and real bookings before credits or payments.
8. Add wallet ledger only with MongoDB transactions and idempotency.
9. Add AI only after database-backed profile, skill, listing, booking, and learning context is trustworthy.

## Phase 0 Exit Decision

Phase 0 is complete when this document is committed together with a verified build/test baseline. Major refactoring can now begin incrementally. No existing feature should be removed until its active imports, route behavior, compatibility requirements, and replacement tests are documented.
