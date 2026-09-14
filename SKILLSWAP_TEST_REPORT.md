# SkillSwap Test Report

Date: 2026-08-23

## Automated results

- Client production build: passed.
- Modules transformed: 2,443 after the Vite 8 / React Router 7 security upgrade.
- Initial client chunk: 245.81 kB minified, 78.38 kB gzip (down 77.13% and 73.98% from the original Phase 31 baseline).
- Backend: 33 suites passed, 106 tests passed, 0 failed.
- `git diff --check`: passed.

## Improvements made

- Swap creation now requires HTTP 201 in the test rather than conditionally skipping assertions.
- Auth fixture cleanup now matches generated emails.
- Registration verifies that browser-default responses do not expose an access token.
- Registration verifies HTTP-only cookies.
- Registration verifies that the stored refresh-token value differs from the cookie credential.
- Invalid and expired access tokens are rejected.
- Logout revokes the persisted refresh session.
- Password-reset tokens are one-time and reset revokes all refresh sessions.
- Password change requires the current password and invalidates the former password.
- Every access and refresh JWT has a unique `jti`, preventing same-second session collisions.
- Cross-site origins are rejected and Socket.IO authentication has positive and negative unit coverage.
- Canonical skill creation requires an admin, while catalog search is public.
- Profile-skill CRUD enforces ownership and keeps affected legacy offered/wanted tags compatible.
- Phase 3 migration completed locally for 5 users and created 7 canonical associations.
- Private account serialization exposes required account data without credential or lockout fields.
- Public handles hide email/account state and enforce anonymous, members-only, private, and owner-preview visibility rules.
- SkillScore is verified to stay inside its 0-100 contract.
- Listing drafts remain private to their owner and unauthorized edits return no existence signal.
- Listing tests cover invalid transitions, publish visibility, pause removal, republish, terminal archive, and archive immutability.
- Unified search returns matching listings, skills, and public mentors while excluding private profiles.
- Compound search verifies rating, proficiency, verification, skill, delivery, language, location, availability, learner level, offer model, and credit ceiling together.
- Every required curated explore section is contract-tested; invalid price ranges are rejected.
- Pure match tests verify overall and every factor remain bounded, and explicitly cover availability, timezone, language, rating, and price behavior.
- Match integration verifies canonical requested/mutual skills, published credit pricing, factor cache persistence, explanation payloads, and private-candidate exclusion.
- Proposal tests cover draft ownership, pre-submit response rejection, current-turn authorization, counter snapshots, turn reversal, acceptance, terminal immutability, requester-only cancellation, and automatic expiry.
- Booking tests verify database-level participant conflicts, reservation cardinality, confirmation ownership, reschedule turn reversal/history, overlapping availability rejection, completion timing, no-show timing/attribution/replay safety, settlement direction, and reservation release.
- Chat tests verify accepted-proposal authorization, pair uniqueness from both directions, outsider denial, text and structured-card persistence, unread reset, and durable read metadata.
- Review tests verify completed-session gating, participant authorization, self-review rejection, six-category persistence, per-reviewer/session uniqueness, dual-participant eligibility, public listing, and reputation recomputation.
- SkillCredits tests verify admin-only adjustments, idempotent replay, conflicting-key rejection, ledger immutability, ledger/projection reconciliation, concurrent double-spend prevention, non-negative balances, and exactly-once booking spend/refund/reward behavior.
- Notification tests verify canonical legacy-type normalization, per-user deduplication, unsafe-link rejection, preference suppression, mandatory system delivery, ownership-safe read operations, unread badge counts, and mark-all behavior; proposal, booking, review, message, session, and credits integrations pass regression.
- AI infrastructure tests verify disabled/unsupported provider failures, the OpenAI Responses request contract, Gemini/Groq response normalization, transient retry, abort timeout, intent routing, structured-output parsing, and exclusion of private context fields.
- Assistant integration tests verify mentor cards resolve to eligible database users, skill cards resolve to canonical catalog records, disabled-provider fallback remains useful and transparent, audit history is owner-scoped and prompt-private, and invalid/empty intents are rejected before context loading.
- Skill-gap tests verify admin-only canonical framework creation, active skill references, actual/required snapshot separation, exact missing and weak classification, priority ordering, real mentor references, deterministic fallback narrative, prompt exclusion, and owner-only detail access.
- Roadmap tests verify invalid date rejection, deterministic generation, canonical target and real mentor references, owner-only access, goal/milestone/task edits, task-to-milestone rollup, milestone-to-task completion, server-derived percentage changes, and automatic completed status.
- My Learning tests verify unique consecutive UTC streak math, learner-only completed booking hours, active skills/roadmaps, canonical plus legacy session counts, milestone rollups, profile and roadmap goals, persisted certificate reads, calculated summaries, and cross-user isolation.
- Community tests verify creator/admin membership, idempotent joins and counters, admin-leave protection, member-only posting, typed question/resource validation, comment persistence/counting, private-community non-disclosure, invitation-only joins, and admin-only member role management.
- Group-session tests verify mentor-qualified creation, server-derived end times, host-only publication, two simultaneous seats filling an exact capacity of two, full-session rejection, enrollment replay, withdrawal seat reopening, preserved cancellation history, host cancellation cleanup, and timed start/completion transitions.
- Challenge tests verify admin-only authoring/publication, bounded reward rules, idempotent enrollment, sequential and 24-hour locks, required evidence, one UTC task per day, exact streak/progress/XP calculations, immutable ledger event counts, and exactly-once SkillCredits, badge, profile achievement, and notification grants.
- Certificate tests verify incomplete-evidence and cross-user denial, completed roadmap/milestone/challenge eligibility, unique replay-safe issuance, public certificate IDs, learner notification, privacy-safe anonymous verification, integrity matching, admin-only revocation, revoked-state verification, and unknown-ID handling.
- Portfolio tests verify active canonical project skills, owner-only mutation, draft non-disclosure, publication/archive lifecycle, active-certificate-only projection without verification secrets, separate teaching/learning counts, group-teaching evidence, verified mentor derivation, and anonymous public-profile privacy.
- Mentor-analytics tests verify unique viewer/entity/day event deduplication, self-view exclusion, exact profile/listing counts, booking requests/conversion/cancellations, one-to-one/group/legacy teaching totals, verified ratings, repeat learners, immutable-ledger credit earnings, proposal response rate, top-skill ordering, un-settled paid-term labeling, and range validation.
- Activity-feed tests verify internal-link allowlisting, event deduplication, private-profile filtering, listing-publication projection, idempotent unique likes/saves, saved filtering, bounded comments, comment ownership, and non-negative engagement counters; challenge, certificate, and roadmap regressions verify their event integrations.
- Safety tests verify bilateral block replay, pending-contact cancellation, request/chat/existing-conversation message denial, unblock recovery, authoritative targets for user/listing/message/review reports, duplicate report replay, self-report denial, administrator-only moderation queues, valid/invalid report transitions, one active-booking dispute, refund cancellation, and moderation audit records. The client production build covers the linked Safety Center, booking disputes, and report entry points.
- Admin-dashboard tests verify ordinary-user denial; moderator access to users/content/safety/sessions and denial from catalog/ledger/analytics; admin account controls without role escalation or higher-role mutation; super-admin-only role changes; audited listing/community/review actions; hidden-review exclusion and reputation recalculation; evidence-backed verification requests/decisions; and operational analytics/resource reads. The production build covers permission-filtered navigation for all eleven areas.
- Settings tests verify the owner-only aggregate never exposes refresh tokens, privacy fields persist and serialize correctly, message permissions apply to both new and existing conversations, learning and notification preferences update through their canonical APIs, email changes require the current password, refresh sessions can be revoked safely, and account deletion requires both password and an explicit confirmation literal. The production build covers all eleven settings sections and transparent unavailable-integration states.
- UI polish verification covers a production build of all 2,594 modules, the semantic dark/light token system, reusable form/card/button/tab/loading/empty/notice primitives, grouped shell navigation, an optimized 83KB hero asset with dimensions and alt text, two-line desktop hero copy, signed-out theme controls, and normalized raw form surfaces. In-app browser checks at 1440x900 and 430x900 found no horizontal overflow, missing hero alt text, or fresh console errors/warnings; both dark and light render paths were inspected.
- Accessibility verification covered 1440, 1280, 1024, 768, 430, and 390 CSS-pixel widths on the homepage and authentication shell with no horizontal overflow. Shared tabs support arrow/Home/End navigation; modal, challenge, and mobile-drawer overlays contain focus, close on Escape, and restore focus. All custom form controls expose labels or accessible names, raw controls were audited, project/chat images have useful alternatives, global focus-visible styling is emitted, reduced-motion overrides disable animation/scroll motion, and a fresh browser tab reported zero console errors. Calculated contrast ratios include 5.55:1 for light secondary text, 8.81:1 for dark secondary text, 5.89:1 for light accent controls, and at least 6.23:1 for dark-theme on-accent controls.
- Performance verification covers 50+ emitted route/shared chunks with no Vite large-chunk warning; the 287.05 kB chart dependency is loaded only by chart routes. The initial chunk fell from 1,074.69 kB/301.23 kB gzip to 311.80 kB/100.88 kB gzip. Match API regression proves a second request reuses the persisted five-minute cache without rewriting it. Chat and safety pagination, new compound indexes, compression, long-lived cache headers for uniquely named uploads, lazy project/chat/avatar images, eager high-priority hero loading, the full 30-suite/90-test backend regression, production build, and fresh lazy-route browser navigation all passed.
- Seed verification ran the non-destructive script twice against the local development database. Both runs produced the same connected dataset: 13 personas, 27 canonical skills, 55 user-skill links, 10 listings, five bookings across completed/confirmed/no-show/cancelled states, three varied reviews, 20 availability rules, six notifications, 19 immutable ledger transactions, three communities, three active learning roadmaps, and three public projects. The script also passed `node --check`, enforces a 12-character seed password minimum, and refuses production execution without explicit acknowledgement.
- The Phase 33 integration journey performs real HTTP registration and login, onboarding updates, teaching-skill creation, listing publication and discovery, proposal negotiation, booking confirmation/completion, review creation, and immutable credit settlement in one coherent flow. Required failure paths remain explicit: duplicate booking/spend/review, expired proposal/token, blocked contact, invalid ownership, pre-end no-show, cancelled-session settlement, and archived-listing non-disclosure. The expanded 31-suite/92-test regression and split production build both pass.
- Observability tests verify recursive credential/JWT redaction and safe generated/preserved request correlation IDs. Production configuration was smoke-tested with a complete HTTPS configuration and with a deliberately unsafe configuration; the former imported successfully and the latter failed before startup. Auth, wallet, booking, and AI regression targets remained green after failure-event instrumentation.
- The final security regression adds rotated refresh-token reuse/family revocation, fail-closed paid booking creation, disguised-upload rejection by magic bytes, HTTP(S)-only external-link validation, bounded realtime signaling, block-safe presence, retry-safe messages, booking race tests, and safe operational failure paths. Complete server and client npm audits report zero vulnerabilities. The Vite 8 build and full 33-suite/106-test backend regression pass.
- Final production QA ran against freshly restarted API/frontend processes and the deterministic demo graph. Browser checks covered learner dashboard/discovery/bookings/progress/credits/settings, mentor listings/proposals/bookings/analytics/profile, chat, communities, group sessions, challenges, roadmaps, certificates, notifications, safety, and every permission-visible administrator tab (analytics, users, skills, listings, reports, disputes, reviews, communities, sessions, transactions, and verification). Mutation-heavy register/login/onboarding/listing/search/proposal/booking/complete/review/credit behavior is covered by the coherent HTTP integration journey. Graceful SIGINT shutdown was also observed end-to-end after fixing the stale-listener defect.

## Browser baseline

- Public homepage and login rendered successfully.
- 430px viewport showed no horizontal document overflow.
- Public mobile navigation no longer exposes an empty menu action.
- React Router v7 transition and splat-resolution future flags are enabled without runtime warnings.

## Remaining coverage

Frontend component/unit coverage, refresh-token reuse-family detection, upload malware scanning, and replica-set transaction/failure-injection testing remain documented future hardening opportunities; the required critical product journey and administrative hierarchy now have integration coverage.
