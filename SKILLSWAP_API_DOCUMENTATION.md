# SkillSwap API Documentation

Base paths: `/api` and `/api/v1`

Both paths currently mount the same compatibility router. New integrations should use `/api/v1`; `/api` remains available for the existing frontend.

## Authentication

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create account and set auth cookies |
| POST | `/auth/login` | Authenticate and set auth cookies |
| POST | `/auth/refresh` | Rotate refresh session and auth cookies; rotated-token reuse revokes the session family |
| POST | `/auth/logout` | Revoke current refresh session |
| POST | `/auth/forgot-password` | Request reset link |
| POST | `/auth/reset-password` | Reset password and revoke all refresh sessions |
| PATCH | `/auth/change-password` | Verify the current password, change it, revoke all other sessions, and issue fresh cookies |

Browser clients use HTTP-only cookies. Access tokens are not returned unless `AUTH_EXPOSE_ACCESS_TOKEN=true` is explicitly configured.

Unsafe cookie-authenticated requests are protected by same-origin checks. Production requests carrying authentication cookies must provide an allowed `Origin`; cross-site browser requests are rejected. Authentication routes use a stricter rate limit than the general API.

## Current Resources

- Users: `/users/me`, `/users`, `/users/:id`, `/users/:id/reviews`
- Professional profiles: `GET /users/by-username/:username` (anonymous for public profiles, authenticated for member profiles, owner-only for private profiles)
- Skill catalog: `GET /skills`, `GET /skills/:identifier`; admin `POST /skills`, `PATCH /skills/:id`, `DELETE /skills/:id` (archive)
- Profile skills: `GET|POST /user-skills/me`, `PATCH|DELETE /user-skills/me/:id`, `GET /users/:id/skills`
- Listings: public `GET /listings`, `GET /listings/:id`; owner `GET /listings/mine`, `POST /listings`, `PATCH /listings/:id`, `POST /listings/:id/publish|pause|archive`
- Explore: `GET /explore` for curated marketplace sections; `GET /explore/search` for paginated skills, mentors, and listings with validated filters and sorting
- Matches: `/matches`
- Swap requests: `/requests`, `/requests/:id`
- Swap proposals: `GET|POST /proposals`, `PATCH /proposals/:id`, `POST /proposals/:id/submit|accept|counter|decline|cancel`
- Sessions: `/sessions`, `/sessions/:id/accept`, `/sessions/:id/complete`
- Bookings: `GET|POST /bookings`, `POST /bookings/:id/confirm|reschedule|cancel|complete|no-show`, `GET|PUT /bookings/availability/me`
- Chat: `/chats`, `/chats/conversation`, `/chats/:conversationId/messages`, `/chats/:conversationId/read`
- Reviews: `/reviews`
- SkillCredits: `GET /credits/wallet`, `GET /credits/transactions`; admin `POST /credits/admin-adjustments`
- Assistant: `POST /assistant/ask`, `GET /assistant/history`
- Career paths: authenticated `GET /career-paths`; admin `POST /career-paths`, `PATCH /career-paths/:id`
- Skill gaps: `POST /skill-gaps/analyze`, `GET /skill-gaps`, `GET /skill-gaps/:id`
- Roadmaps: `POST /roadmaps/generate`, `GET /roadmaps`, `GET|PATCH /roadmaps/:id`; milestone `POST /roadmaps/:id/milestones`, `PATCH|DELETE /roadmaps/:id/milestones/:milestoneId`, `POST /roadmaps/:id/milestones/:milestoneId/complete`; task `POST /roadmaps/:id/tasks`, `PATCH|DELETE /roadmaps/:id/tasks/:taskId`
- My Learning: `GET /learning/me`
- Communities: `GET|POST /communities`, `GET /communities/:key`, `POST /communities/:id/join|leave`, admin `PUT /communities/:id/members/:userId/role`, `GET|POST /communities/:id/posts`, `GET|POST /communities/:id/posts/:postId/comments`
- Group sessions: `GET|POST /group-sessions`; host `POST /group-sessions/:id/publish|start|complete|cancel`; participant `POST /group-sessions/:id/enroll|withdraw`
- Challenges: `GET /challenges`, `GET /challenges/:id`, `POST /challenges/:id/enroll|abandon`, `POST /challenges/:id/days/:day/complete`, `GET /challenges/enrollments/me`, `GET /challenges/xp/me`; admin `POST /challenges`, `POST /challenges/:id/publish`
- Certificates: anonymous `GET /certificates/verify/:id`; learner `GET /certificates/me`, `GET /certificates/eligibility`, `POST /certificates/issue`; admin `POST /certificates/:id/revoke`
- Portfolio projects: owner `GET /projects/me`, `POST /projects`, `PATCH /projects/:id`, `POST /projects/:id/publish|archive`; published projects are returned through the privacy-gated professional profile
- Mentor analytics: `GET /analytics/mentor?rangeDays=7|30|90|365|all`; legacy user stats remain at `GET /analytics/user`
- Activity feed: `GET /feed`; `POST|DELETE /feed/:id/like`, `POST|DELETE /feed/:id/save`, `GET|POST /feed/:id/comments`, `DELETE /feed/comments/:commentId`
- Safety: `GET /safety/blocks`, `POST|DELETE /safety/blocks/:userId`; `GET /safety/reports/me`, `POST /safety/reports`; `GET /safety/disputes/me`, `POST /safety/disputes/bookings/:bookingId`; admin `GET|PATCH /safety/moderation/reports[/:id]`, `GET|PATCH /safety/moderation/disputes[/:id]`
- Notifications: `/notifications`, `/notifications/unread-count`, `/notifications/:id/read`, `/notifications/read-all`, `GET|PUT /notifications/preferences`
- Settings: `GET /settings`; `PATCH /settings/account|privacy|learning|accessibility`; `GET /settings/security/sessions`; `DELETE /settings/security/sessions/others`, `DELETE /settings/security/sessions/:id`; confirmed `DELETE /settings/account`
- Dashboard: `/dashboard/stats`
- Analytics: `/analytics/user`, `/analytics/platform`
- Reports: `/reports`
- Admin access/analytics: `GET /admin/access`, `GET /admin/stats`, `GET /admin/analytics`
- Admin resource areas: `GET /admin/users|skills|listings|reports|disputes|reviews|communities|sessions|transactions|verification-requests`; permission-gated `PATCH` actions are available for accounts/roles, skill status, listing moderation, review visibility, community status, and verification decisions
- Health: `/health`

## Current Envelope

Current handlers consistently include `success`, but resource keys still vary. The target success envelope is:

```json
{"success":true,"data":{},"message":"","meta":{}}
```

The target error envelope is:

```json
{"success":false,"error":{"code":"","message":"","details":{}},"requestId":""}
```

All new endpoints must validate body, query, and params with Zod and enforce ownership/role checks in the backend.

Every HTTP response includes `X-Request-Id`. A safe inbound correlation ID is preserved; otherwise the API generates one. Structured logs include that ID, route template, status, duration, stable error code, and authenticated user ID where available, but never bodies, query values, cookies, authorization headers, passwords, tokens, secrets, or provider keys.

## Skill compatibility contract

`Skill` is the canonical catalog and `UserSkill` owns teach/learn intent, proficiency, experience, verification, descriptions, and evidence. During migration, writes also synchronize only the affected name in `User.skillsOffered` and `User.skillsWanted`; unrelated legacy values are preserved. `npm run migrate:phase3` idempotently backfills canonical records from existing arrays.

Listing creation and publication require an active canonical teaching skill. Draft and paused listings are owner-only, published listings are discoverable, and archived listings are immutable. At least one offer model—exchange, credits, or paid—is required; positive costs are enforced when credits or payment are enabled.

Explore filters include category, skill, rating, proficiency, price range, credit ceiling, delivery mode, language, location, availability, verification, mentor/listing experience, and offer model. Sort values are `best_match`, `highest_rated`, `most_experienced`, `lowest_price`, `most_active`, and `newest`. Phase 6 `best_match` uses deterministic marketplace signals; Phase 7 owns the richer explainable compatibility score.

`GET /matches` returns a bounded `matchScore`, the complete normalized `factors` map, `strengths`, `conflicts`, and ranked human-readable `reasons`. Factors cover requested skill, mutual exchange, availability, timezone, location, language, learning goals, experience, learning/teaching modes, reputation, and offer-price compatibility. Scores are deterministic and do not use AI.

Proposals start as requester-owned drafts. Submission assigns the response turn to the recipient; every counter snapshots the prior terms and assigns the next turn to the other participant. Only the current responder can accept, counter, or decline; only the requester can cancel. Accepted and other terminal states are immutable, and stale negotiations become expired during reads/actions.

Bookings are created only from accepted proposals. Every 15-minute interval is reserved for both participants in a uniquely indexed slot collection, making concurrent overlap attempts fail at the database boundary. Reschedules require confirmation by the other participant. Times are stored as UTC dates with the viewer, teacher, and student IANA timezones retained for display and availability interpretation. Completion and no-show reporting require the scheduled end to have passed and are replay-safe terminal settlements: a teacher-reported learner absence rewards eligible teaching credits, while a learner-reported teacher absence refunds reserved credits. Paid terms fail with `PAYMENT_REQUIRED` until authoritative checkout is configured.

Conversations are available only to the two participants and require an accepted/completed proposal, an active booking, or a completed legacy swap. The sorted participant pair is uniquely keyed so concurrent creation converges on one conversation. Messages support text, up to five size-limited, extension/MIME-matched, magic-byte-verified image/document attachments, and one authorized booking, proposal, or active-skill card. `PATCH /chats/:conversationId/read` persists `seenBy`, `read`, and `readAt`; Socket.IO uses authenticated participant rooms, a 100KB transport ceiling, bounded event rates, validated identifiers, and relationship-gated call signaling.

Member blocking is a separate bilateral contact boundary from administrator account suspension. A block cancels pending proposals/legacy requests and prevents either party from creating requests, proposals, conversations, messages, bookings, or realtime call signals; history remains readable as evidence. Reports resolve their authoritative target and reported member server-side, message targets require conversation membership, and duplicate submissions replay the original report. Only active confirmed/upcoming/in-progress participant bookings can enter the dispute state. Report and dispute transitions are explicit, administrator-only, and append a moderation audit record; refund resolution uses the idempotent credit ledger and releases booking slots.

Administration uses named server permissions rather than client role checks. Moderators can read users and moderate content, reports, disputes, sessions, and verification requests; administrators add account, catalog, transaction, and analytics access; only super administrators can change platform roles. An actor can never mutate their own account through admin endpoints, manage an equal/higher role, or assign a role at/above their own rank. Ledger transactions are read-only. User skill verification requires teaching intent and evidence, and later skill edits invalidate the decision.

`GET /settings` returns an owner-only aggregate for account, profile, notifications, privacy, security, learning preferences, availability, connected accounts, billing, and accessibility without exposing refresh-token material. Privacy writes control profile and location visibility, online and last-active disclosure, and who may initiate messages. A recipient set to `matches` accepts contact only across an eligible marketplace relationship; `no_one` also blocks new messages in an existing conversation while retaining readable history. Email changes require the current password and reset verification. Session endpoints expose only safe device metadata and support targeted or all-other-session revocation. Account deletion requires both the current password and the literal `DELETE`, then deactivates and anonymizes the account and revokes every refresh session.

`POST /reviews` accepts a completed `sessionId`, all six ratings (`communication`, `knowledge`, `teaching`, `punctuality`, `professionalism`, `overall`), an optional comment, and `wouldLearnAgain`. The backend derives the other participant as the reviewee; submitted self or unrelated reviewees are rejected. One review per reviewer/session is enforced both in the service and by a unique index. Creation atomically triggers a reputation recalculation from persisted review evidence. Legacy completed-swap review input remains compatible during migration.

SkillCredits use `wallets` only as a fast non-negative projection; `credittransactions` are the immutable source of truth and every wallet response includes a ledger reconciliation signal. All amounts are signed server-side integers. Unique idempotency keys and internal operation claims prevent replay, duplicate reward/refund, and conflicting reuse. Conditional wallet debits enforce available balance at the database boundary under concurrent spending. Requested-leg credit bookings spend from the student at creation, refund once on cancellation, and reward the teacher once on completion. User-facing APIs cannot mint or transfer credits; adjustments require an administrator.

Notifications use the canonical types `proposal`, `booking`, `booking_reminder`, `message`, `review`, `credits`, `badge`, `community`, `session`, `certificate`, and `system`; legacy event names are normalized at creation. A centralized service enforces per-user in-app preferences, an internal deep-link allowlist, optional dedupe keys, persistence, and full-record Socket.IO delivery. System notifications bypass muting. Booking reminder processing is idempotent for 24-hour and one-hour windows; scheduler wiring is owned by the later jobs phase.

AI calls must flow through `services/ai/aiService`; controllers must not instantiate provider clients or call provider URLs. `AI_PROVIDER` selects `openai`, `gemini`, `groq`, or the safe default `disabled`; `AI_MODEL` is explicit so deployments control model choice without code changes. Provider adapters return one normalized response contract. Context and prompts are centrally bounded, private account fields are omitted, retries are limited to transient failures, and every request has a hard timeout. OpenAI uses the Responses endpoint with non-persistent requests; tests use injected fetch/provider fixtures and never require live credentials.

The assistant accepts a bounded message plus an optional supported intent and owned target record. Its context loader queries the current user's safe profile projection, canonical skills, deterministic matches, published listings, and participant bookings. Cards are constructed exclusively by the backend from those queried records; provider text cannot manufacture card IDs or modify authoritative state. If AI is disabled or fails, the same endpoint returns a transparent deterministic answer from real context. Interaction logs retain a prompt hash, response metadata, grounded references, latency, and status—not raw prompts or full context.

Career paths are versioned frameworks whose required skills must reference active canonical `Skill` records. Only administrators may create or revise them. Skill-gap analysis snapshots the requesting user's actual `UserSkill` records and the selected framework version, then deterministically classifies missing skills, below-target skills, and priority-ordered next skills. Mentor recommendations reference only active, non-private users with matching teaching records and expose a deterministic suitability score with evidence. Optional provider text is stored solely as `generatedNarrative`; it cannot mutate the authoritative snapshots or gap arrays. Analysis detail and history are owner-scoped.

Roadmap generation requires an active canonical target skill, a concrete goal, and a valid start/target date interval. When configured, the AI provider may propose only bounded milestone/task text through a strict JSON schema; invalid or unavailable output falls back to a deterministic four-stage plan. Target skills, career-path linkage, gap-analysis ownership, mentor references, dates, progress, completion timestamps, and status remain backend-authoritative. Milestone completion updates its tasks, task completion rolls up milestone state, and the roadmap's 0-100 progress and completed status are recalculated on every edit. Every read and mutation is owner-scoped.

`GET /learning/me` is a read-only, owner-scoped projection. Active skills come from learning-enabled canonical `UserSkill` rows; roadmap and milestone values come from roadmap aggregates; hours learned sum durations only for completed bookings where the current user is the student; upcoming/completed canonical bookings and legacy learner sessions remain distinguishable; streaks use unique UTC calendar days from persisted completions; certificates come only from active certificate records; goals combine profile goals with roadmap goals. `calculatedAt` identifies the projection time.

Communities use a separate uniquely indexed membership collection rather than relying on unbounded member arrays. Creation grants the owner an admin membership. Public joins are idempotent; private groups require an admin to add the member. Only active members may publish typed discussions, questions, resources, or comments; resource posts require a validated URL. Private community detail/feed reads return no existence signal to non-members. Admin role changes synchronize the community's admin/moderator projections, and admin memberships cannot leave until access is transferred or removed.

Group-session creation requires an active canonical teaching skill or mentor/admin role, a future UTC instant, IANA timezone, bounded duration/capacity, valid mode details, and at most one charge model. Sessions move through guarded draft, published/full, in-progress, completed, or cancelled states. Enrollment claims a unique participant/session record before an atomic `participantCount < capacity` increment, preventing parallel overbooking. SkillCredit enrollment uses the immutable ledger; withdrawal/host cancellation refund once, and completion rewards the mentor once. Paid enrollment is explicitly rejected until the later payment provider phase rather than recording unpaid access as settled.

Challenges are admin-authored programs over one active canonical skill. The task list must contain exactly one sequential task for every challenge day; per-task XP is bounded, completion bonus XP cannot exceed total daily XP, and credit rewards cannot exceed ten credits per day. Enrollment is idempotent. Tasks must be completed in order, unlock at 24-hour intervals, and permit at most one completion per UTC date; required evidence must be a valid URL. XP is written to an immutable, idempotent ledger. Final completion grants the declared bonus, SkillCredits, unique badge, profile achievement, and deduplicated notification exactly once.

Certificate issuance accepts only an owned, completed challenge, completed roadmap, or completed roadmap milestone. The server derives learner, canonical skill, achievement title, completion evidence, and a unique source key; the request cannot supply credential claims. Replays return the same certificate. `GET /certificates/verify/:id` accepts the public certificate ID or high-entropy verification code and returns an allowlisted learner/skill/achievement/status view with a SHA-256 integrity result, never account email or private fields. Only administrators can revoke an active credential, with a required reason and learner notification.

Portfolio projects are owner-scoped drafts over one to ten active canonical skills. URLs, dates, outcomes, featured state, and bounded copy are validated; only drafts can publish and active projects can archive. Professional profile reads enforce profile visibility before loading evidence and return only published projects and active certificates. Stats distinguish sessions taught (including completed group sessions) from sessions learned, expose verified/learning skill counts, and derive mentor status from real teaching skills, verification, completed teaching, and published listings. The public projection never includes account email or certificate verification secrets.

Mentor analytics view counts are unique per viewer, entity, and UTC date; self-views are excluded and anonymous visitor identity is stored only as a salted one-way event key. The dashboard calculates booking requests, completed-booking conversion, sessions taught, verified-review average, repeat learners, teaching credits, proposal response rate/time, booking cancellation rate, and top skills from domain records inside the selected range. Each rate ships with its denominator definition. Paid booking terms remain labeled un-settled and are not presented as realized revenue before a payment ledger exists.

The activity feed has no arbitrary event-creation endpoint. Internal services project only allowlisted certificate, challenge, listing, roadmap-milestone, public-community-post, mentor-achievement, and group-session transitions with a unique dedupe key and safe internal link. Feed reads are authenticated and exclude disabled/private-profile actors. Likes and saves are idempotent unique user/activity records; comments are bounded and removable only by their author or a moderator/administrator. Counters change only after the underlying unique engagement mutation succeeds.

## Profile serialization

Authenticated account endpoints use a private allowlist that includes email and account status but excludes every credential, reset, lockout, refresh, and upload-provider field. Marketplace profiles use a separate public allowlist. Profile visibility is enforced before reviews, canonical skills, or computed stats are returned.
