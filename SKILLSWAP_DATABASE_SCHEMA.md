# SkillSwap Database Schema

## Current Collections

| Collection | Purpose | Important constraints |
| --- | --- | --- |
| users | Identity, rich profile, compatibility skill arrays, rating/category-reputation/SkillScore/session caches, badges, achievements, privacy, learning, and accessibility preferences | Unique email and sparse username; profile/location/presence/contact visibility; status/role and soft-delete/block flags |
| skills | Canonical skill catalog | Unique name and slug; category/status/popularity indexes; text search |
| userskills | User-to-skill capability and learning intent | Unique user+skill; teach/learn, proficiency, experience, verification, evidence indexes |
| listings | Versioned mentor/teaching offers | Unique slug; owner/status, skill/rating, delivery/pricing, and text-search indexes; terminal archive state |
| swapproposals | Canonical skill-exchange negotiations | Participant/status/turn/expiry indexes, optimistic concurrency, immutable revision snapshots, terminal states |
| availabilityrules | Recurring weekly teaching availability | Unique user/day/start/end; active/day lookup; IANA timezone and supported modes |
| bookings | Confirmable scheduled proposal sessions | Unique proposal/leg/sequence; participant/status/time indexes; reschedule/reminder data plus completion, cancellation, dispute, and attributed no-show evidence |
| bookingslots | Concurrency-safe 15-minute participant reservations | Unique user+slotStart; booking cleanup index |
| swaprequests | Direct skill swaps | Participant/status indexes |
| sessions | Basic swap slot proposals | Request and participant indexes |
| reviews | Verified structured session reviews with legacy swap compatibility | Unique reviewer+session; six bounded rating categories, reviewee, comment, and repeat-learning signal |
| wallets | Non-negative SkillCredits balance projection | Unique user; revision and lifetime projection counters; never the sole source of truth |
| credittransactions | Immutable SkillCredits ledger | Unique transaction/idempotency IDs; signed amount, bounded type, related entity, description, and balance-after snapshots |
| creditoperations | Idempotent credit-operation claims | Unique idempotency key; pending/completed/failed recovery state prevents concurrent replay |
| conversations | Relationship-gated two-party chat | Unique sorted participant key; participant and last-message indexes; per-user unread counts |
| messages | Persisted typed chat messages | Conversation/time and unread/sender indexes; attachment metadata; authorized booking, proposal, or skill references; durable read receipts |
| notifications | Typed in-app events and safe deep links | User/read/type/time indexes; unique per-user dedupe keys; priority and metadata |
| notificationpreferences | Per-user delivery controls | Unique user; per-type in-app toggles, email digest cadence, and push opt-in |
| aiinteractions | Privacy-minimized assistant audit records | User/time index; prompt hash rather than raw prompt, intent/provider/status, real card references, latency, and error code |
| careerpaths | Versioned canonical career-goal frameworks | Unique slug; active/archive lifecycle; admin provenance; unique active skill requirements with minimum proficiency, importance, rationale, and order |
| skillgapanalyses | Point-in-time career readiness analyses | Owner/path/time indexes; separate actual and required snapshots; deterministic missing/weak/recommended arrays; real mentor references; isolated advisory narrative |
| roadmaps | Owner-scoped learning plans | Canonical target skill; optional career/gap provenance; bounded embedded milestones/tasks; mentor snapshots; validated date range; derived progress/status; optimistic document concurrency |
| certificates | Eligibility-backed public learning credentials | Unique certificate ID, verification code, and non-legacy source key; immutable learner/skill/achievement/provenance/evidence/integrity fields; active/revoked status with revocation audit |
| communities | Skill/category community metadata and role projections | Unique slug; public/private visibility; owner/admin/moderator references; bounded rules; atomic member/post counters |
| communitymemberships | Scalable community membership authority | Unique community+user; admin/moderator/member role; active/left/banned lifecycle; user/status index |
| communityposts | Typed community discussions, questions, and resources | Community/status/time and author/time indexes; validated resource URL; comment counter; soft removal |
| communitycomments | Member replies to community posts | Community/post/author references; post/status/time index; soft removal |
| groupsessions | Mentor-hosted multi-learner sessions | Mentor/skill/community references; UTC interval and timezone; bounded capacity and prices; indexed lifecycle; optimistic concurrency |
| groupsessionenrollments | Group-session seat and attendance history | Unique session+participant; pending/enrolled/cancelled/attended/no-show lifecycle; immutable charge snapshots |
| challenges | Admin-authored canonical-skill daily programs | Unique slug; exact sequential task count; bounded XP/credit/badge rules; publish lifecycle and counters |
| challengeenrollments | Per-user challenge progress projection | Unique challenge+user; status, progress, UTC streak, XP, and reward projections |
| challengedaycompletions | Evidence-backed daily challenge activity | Unique enrollment+day and enrollment+UTC activity date; immutable awarded XP snapshot |
| xptransactions | Immutable challenge XP ledger | Unique idempotency key; positive server-derived points and append-only mutation guards |
| challengebadgegrants | Earned challenge credentials | Unique user+challenge grant; immutable badge snapshot and enrollment provenance |
| projects | Professional portfolio work evidence | Owner/status/featured index; 1-10 unique canonical skills; bounded outcomes/URLs/dates; draft/published/archived lifecycle |
| analyticsevents | Privacy-minimized discovery measurements | Unique salted viewer/type/entity/UTC-day key; subject/type/date indexes; no raw IP or user-agent persistence |
| activities | Secondary domain-event feed projections | Unique transition dedupe key; allowlisted type/entity/link; actor/skill provenance; active/hidden lifecycle and bounded counters |
| activitylikes | Feed likes | Unique activity+user; user/time index |
| activitysaves | Private saved-feed membership | Unique activity+user; user/time index |
| activitycomments | Bounded feed discussion | Activity/status/time and author/time indexes; active/removed moderation lifecycle |
| refreshtokens | Refresh sessions | Unique hashed token; family ID, rotation/revocation timestamps, hidden replacement hash, user/active-session index, and TTL expiry |
| matchcaches | Cached recommendations | Unique user/matched-user pair |
| reports | Basic user reports | Reporter and reported-user indexes |

## Deliberately deferred collections

`payments`, `paymentWebhookEvents`, and `refunds` remain deferred until an authoritative provider is selected. `savedListings` and periodic `reputationSnapshots` are optional scale/read-model additions. Disputes, moderation actions, administrator audits, verification workflows, learning progress, and skill categories are already represented by current models or authoritative projections.

## Integrity Rules

- Keep legacy string skills during canonical-skill migration and backfill references before removal.
- Archiving a catalog skill preserves user associations; user-skill writes synchronize only that skill's legacy tags.
- Use unique indexes plus transactions, not controller check-then-create logic, for duplicate prevention.
- Credit balances must reconcile to an immutable transaction ledger.
- Credit debits use a conditional `balance >= spend` update; reward, refund, and spend keys are deterministic per booking and cannot be replayed.
- Booking start/end values are dates in UTC. Reject overlap at the database/service boundary.
- Active booking intervals materialize as unique 15-minute reservations for both participants; terminal cancellation/completion/no-show releases them. No-show rows retain the reporter, absent participant, reason, and timestamp, and settle credits in the reporter-dependent direction exactly once.
- A conversation is unique per sorted pair and its messages/cards are accessible only to participants with an eligible marketplace relationship.
- Reviews require a completed eligible booking and one review per reviewer/booking.
- Reviewees are derived from booking participants, never trusted from client input; cached category reputation is recalculated from the review collection.
- Refresh tokens are stored as SHA-256 hashes and expire through a TTL index. Rotation retains a revoked family member as reuse evidence; presenting it revokes every still-active member of that family.
- SkillScore is deterministic and recalculated from profile completeness, stored reputation, completed sessions, and verified skills; AI never assigns it.
- Match cache records store the exact deterministic score, normalized factor map, strengths, conflicts, and reasons for auditability.
- Career requirements reference active canonical skills and revision increments preserve the framework version used by historical analyses.
- Skill-gap snapshots, classifications, and mentor references are server-derived; AI prose is stored separately and never changes actual proficiency state.
- Roadmap AI output is accepted only as bounded milestone/task copy; canonical targets, owned provenance, real mentors, date integrity, progress, completion, and lifecycle state are computed or validated server-side.
- My Learning is a query projection rather than a mutable stats record: learned hours, session counts, milestones, active skills, goals, certificates, and streak dates are recalculated from their source collections.
- Community membership authority lives in the unique membership row; embedded admin/moderator arrays and counts are bounded projections updated only by domain services.
- Group-session capacity uses a unique enrollment claim plus an atomic conditional counter update; failed payment/spend claims compensate the counter, and cancellation/completion settlement is idempotent through ledger keys.
- Challenge progress can advance only one sequential task after its 24-hour unlock and only once per UTC activity date. XP values come from the published task snapshot, the XP ledger is append-only, and unique ledger/badge/credit/notification keys make final rewards replay-safe.
- Certificates are derived only from owned completion evidence. A unique source key prevents duplicate credentials, immutable provenance fields prevent claim editing, and the stored integrity hash lets the public verifier detect record drift while revocation remains an explicit audited state.
- Project mutations are owner-scoped and archived projects are terminal. Only published projects cross the professional-profile privacy boundary; referenced skills must exist and remain canonical at write time.
- Analytics view events exclude self-views and deduplicate at the database boundary. Derived mentor rates retain explicit denominators; credits come from the immutable ledger, reviews from verified review rows, and un-settled paid terms are never labeled realized revenue.
- Feed events originate only from domain services and deduplicate by transition. Private/disabled actors are filtered at read time; unique like/save claims and conditional counter decrements prevent engagement replay and negative counters.
- `UserBlock` uniquely identifies a blocker/blocked pair and is the bilateral contact authority; it is intentionally distinct from the account-wide `User.isBlocked` administration flag.
- `Report` stores a unique reporter/type/target fingerprint, resolved reported member, category, evidence links, priority, lifecycle history, assignment, and resolution while retaining legacy reporter fields for compatibility.
- `Dispute` is unique per booking and records both participants, immutable prior booking status, evidence, assignment, resolution, and state history. `ModerationAction` is the append-only audit trail for report/dispute decisions.
- `AdminAudit` is immutable and records actor/role, action, target, bounded before/after snapshots, note, and timestamp for account, catalog, content, and verification mutations.
- `Review.moderationStatus` controls public visibility; hiding/restoring a review triggers reputation recomputation. `UserSkill` stores verification request/reviewer timestamps and notes; profile edits reset prior verification to protect evidence integrity.
- Public serializers apply profile, location, online-status, and last-active policy independently; private settings serializers remain owner-only. Message permission is enforced against the recipient at every send, not only at conversation creation. Account deletion is a password-confirmed soft-delete/anonymization operation with refresh-session revocation.
