# SkillSwap — Execution Roadmap and Phase A Implementation

This document follows the requested format:
- Step 1: Codebase audit and feature plug-in map
- Step 2: Phased roadmap
- Step 3: Per-phase technical changes map
- Step 4: Actual Phase A implementation summary
- Step 5: Migration/manual steps + local testing

---

## Step 1) Codebase Audit and Feature Plug-In Map

## Current architecture anchors
- Backend app boot: `server/src/app.js`, `server/src/server.js`
- Core domain APIs: `server/src/routes/*`, `server/src/controllers/*`
- Domain models: `server/src/models/*`
- Matching logic: `server/src/services/matchService.js`
- Session lifecycle: `server/src/controllers/sessionController.js`, `server/src/models/Session.js`
- Frontend routing: `client/src/App.jsx`
- Global state: `client/src/app/store.js`, `client/src/features/*`
- Discover and dashboard UX: `client/src/pages/DiscoverPage.jsx`, `client/src/pages/DashboardPage.jsx`
- Session UX: `client/src/pages/SessionsPage.jsx`

## Where each requested layer plugs in

1. **Product experience layer**
   - Frontend pages + reusable components:
   - `client/src/pages/DiscoverPage.jsx`
   - `client/src/pages/DashboardPage.jsx`
   - `client/src/components/*`

2. **Credit economy system**
   - Backend model/service/controller/routes:
   - `server/src/models/CreditTransaction.js`
   - `server/src/services/creditService.js`
   - `server/src/controllers/creditController.js`
   - `server/src/routes/creditRoutes.js`
   - User ledger fields in `server/src/models/User.js`
   - Frontend slice + dashboard widgets:
   - `client/src/features/credits/creditsSlice.js`
   - `client/src/pages/DashboardPage.jsx`

3. **Trust/verification/safety**
   - User schema extensions in `server/src/models/User.js`
   - Trust scoring helper in `server/src/utils/trust.js`
   - Response enrichment in:
     - `server/src/controllers/userController.js`
     - `server/src/services/matchService.js`
     - `server/src/controllers/dashboardController.js`

4. **AI and smart matching**
   - Extend `server/src/services/matchService.js`
   - Add `server/src/services/aiRecommendationService.js` (Phase C)
   - Add async jobs and cached rank materialization (Phase C/D)

5. **Chat -> collaboration workspace**
   - Add conversation workspace schema and APIs:
   - `server/src/models/Conversation.js` (extend), new workspace model (Phase B)
   - `server/src/controllers/chatController.js`, `server/src/socket/index.js`
   - `client/src/features/chat/chatSlice.js`, `client/src/pages/ChatPage.jsx`

6. **Session system upgrade**
   - Session state machine in:
   - `server/src/models/Session.js`
   - `server/src/controllers/sessionController.js`
   - `server/src/routes/sessionRoutes.js`
   - UX flow in:
   - `client/src/features/sessions/sessionSlice.js`
   - `client/src/pages/SessionsPage.jsx`

7. **Gamification/referrals/retention**
   - New models and services in server (`Achievement`, `Referral`, `Goal`)
   - Dashboard modules in client (`DashboardPage.jsx`)

8. **Monetization**
   - Subscription and gating models/routes in backend
   - Plan-gated UI states in client, admin config controls

9. **Analytics and founder dashboard**
   - Expand rollups in `server/src/controllers/analyticsController.js`
   - Add advanced charts in `client/src/pages/AdminPage.jsx`, `DashboardPage.jsx`

10. **Engineering scale/quality**
- Centralized config/constants, queues, feature flags, stricter CI, observability hooks

11. **UX/design system strategy**
- Consolidate reusable primitives in `client/src/components/ui/*`

---

## Step 2) Phased Implementation Roadmap

## Phase A — Launch-Critical (Implemented first)
- Premium discover cards + score visualization + explainability
- Trust/profile strength surfacing
- Credit economy foundation (ledger, APIs, dashboard visibility)
- Session lifecycle expanded (cancel, reschedule, no-show, complete outcome)
- Dashboard upgraded with trust + credits blocks

## Phase B — Trust + Retention
- Report/dispute state machine hardening
- Response/completion rate persistence and penalties
- Moderation queue improvements + admin SLA views
- Streaks, badges, weekly goals, nudges

## Phase C — AI + Monetization
- Hybrid rule-based + AI ranking
- AI copilot (profile improve, request drafting, session summaries)
- Plan tiers, feature gating, usage caps, premium visibility
- Payment provider integration interfaces

## Phase D — Scale + Platform Expansion
- Redis cache + queue workers
- Background jobs (reminders, recompute, nudges)
- Socket horizontal scaling pattern
- OpenAPI, ERD/data dictionary, stricter CI and test depth

---

## Step 3) Per-Phase Change Map

## Phase A
- **Backend files create/update:**
  `server/src/models/User.js`, `server/src/models/Session.js`, `server/src/models/CreditTransaction.js`, `server/src/utils/trust.js`, `server/src/services/creditService.js`, `server/src/services/matchService.js`, `server/src/controllers/creditController.js`, `server/src/controllers/sessionController.js`, `server/src/controllers/userController.js`, `server/src/controllers/dashboardController.js`, `server/src/routes/creditRoutes.js`, `server/src/routes/sessionRoutes.js`, `server/src/app.js`, `server/src/validators/user.js`
- **Frontend files create/update:**
  `client/src/components/MatchCard.jsx`, `client/src/features/credits/creditsSlice.js`, `client/src/app/store.js`, `client/src/pages/DiscoverPage.jsx`, `client/src/pages/DashboardPage.jsx`, `client/src/features/sessions/sessionSlice.js`, `client/src/pages/SessionsPage.jsx`
- **Schema changes:** user trust/credits/verifications + session state/mode metadata + credit transaction ledger model
- **API changes:** added `/api/credits/me`, `/api/credits/admin/adjust`; added session transitions `/reschedule`, `/cancel`, `/no-show`; enriched user/match/dashboard payloads with trust/profile/credit fields
- **Redux changes:** new `credits` slice; session actions expanded; discover/dashboard consume enriched data
- **Socket changes:** no protocol change in this block (kept stable)
- **Admin/dashboard changes:** admin credit adjustment endpoint added; dashboard shows credit and trust indicators

## Phase B (Planned)
- Add moderation state transitions, SLA metadata, anti-spam cooldowns
- Add retention models (streaks/badges/goals/referrals) and dashboard widgets

## Phase C (Planned)
- Add AI recommendation service abstraction, semantic skill similarity, explainable reason taxonomy
- Add subscription/plan/usage-limit models and middleware gates

## Phase D (Planned)
- Add queue + cache layer, distributed socket adapter plan, OpenAPI generation, quality gates

---

## Step 4) Phase A — Actual Code Implemented

## A. Credit economy foundation
- Added `CreditTransaction` model for immutable ledger records.
- Added `creditService` with:
  - `adjustCredits`
  - `settleSessionCredits`
  - `applyNoShowPenalty`
- Added endpoints:
  - `GET /api/credits/me`
  - `POST /api/credits/admin/adjust` (admin only)
- Integrated routes in `app.js`.

### Backend logic
- Credits are stored in user document:
  - `creditsBalance`
  - `creditsEarned`
  - `creditsSpent`
- Every credit mutation writes a transaction row with `balanceAfter`.
- Session completion in `CREDIT` mode triggers:
  - teacher earn
  - student spend

### Frontend logic
- Added Redux credits slice.
- Dashboard fetches and displays:
  - credits balance
  - earned
  - spent

### Edge cases handled
- Balance cannot drop below `0`.
- Admin adjust validates numeric amount and userId.

## B. Trust and profile strength signals
- Added user trust-related fields:
  - `phoneVerified`, `identityVerified`, `portfolioLinks`, `linkedinUrl`, `githubUrl`
  - counters: `noShowCount`, `cancellationCount`
- Added trust utility with:
  - `calculateProfileStrength`
  - `calculateTrustScore`
  - `getTrustBadge`
- Enriched response payloads for:
  - current user
  - user list
  - user profile by id
  - match cards (user payload inside match result)
  - dashboard stats

### UX behavior
- Trust score and profile strength now visible in dashboard/match cards.
- Match cards now expose trust badge and richer “why matched” context.

## C. Discover premium UX improvements
- Added reusable `MatchCard` component with:
  - score visualization bar
  - trust badge
  - why-matched chips
  - concise profile summary
- `DiscoverPage` now:
  - uses improved card design for match tab
  - includes clearer loading/error states for matches

## D. Session system upgrade (incremental)
- Session schema expanded:
  - mode: `SWAP` or `CREDIT`
  - new statuses: `RESCHEDULED`, `CANCELED`, `NO_SHOW`, `DISPUTED`
  - metadata: `meetingLink`, `notes`, `outcomeSummary`, `canceledBy`, `noShowBy`
- Added session APIs:
  - `PATCH /api/sessions/:id/reschedule`
  - `PATCH /api/sessions/:id/cancel`
  - `PATCH /api/sessions/:id/no-show`
- Extended complete flow to support `outcomeSummary`.
- Frontend sessions page:
  - session mode selector on create
  - optional outcome summary
  - cancel action

---

## Step 5) Migration / Manual Steps / Local Testing

## Migration/manual steps
1. Restart backend after pulling changes.
2. Existing Mongo documents remain valid (new fields have defaults).
3. Optionally backfill trust/profile values in analytics scripts if needed.
4. For credit mode sessions, ensure users have enough initial balance via:
   - admin adjust endpoint (or seed script extension later).

## Local test checklist

### Backend sanity
```bash
cd server
node -e "import('./src/app.js')"
```

### Frontend build sanity
```bash
cd client
npm run build
```

### Functional checks
1. Login as regular user.
2. Open Dashboard:
   - verify credits card appears
   - verify trust/profile cards appear
3. Open Discover:
   - verify match score bar + reasons + trust badge
4. Create a session in `CREDIT` mode, confirm and complete:
   - verify credits update via `GET /api/credits/me`
5. As admin, call `POST /api/credits/admin/adjust` and verify ledger + balance.
6. Validate session cancel/no-show endpoints from UI or API client.

---

## Next Block to Implement (recommended immediate)

1. Enforce credit sufficiency for student before confirming/completing credit-mode sessions.
2. Add response/completion rate persistence on user model and include in trust score.
3. Upgrade admin page with credit adjustments UI and trust-risk filters.
4. Add reminders timeline with background job placeholder + notification scheduling endpoint.

---

## Phase B Progress Update (Implemented)

### What was changed
- **Moderation/report workflow upgraded**
  - `Report` now has status state machine (`OPEN`, `UNDER_REVIEW`, `ESCALATED`, `RESOLVED`, `REJECTED`)
  - Added report metadata: `priority`, `category`, `resolutionNotes`, `actionTaken`, `resolvedBy`, `resolvedAt`
  - Added anti-spam cooldown: users cannot report same target repeatedly within 24 hours
- **Admin moderation controls upgraded**
  - Added admin report status update API
  - Added user suspension APIs (`suspend`, `unsuspend`)
  - Added frontend admin UI actions for suspension and report status transitions
- **Reliability/trust metrics strengthened**
  - User schema now tracks `completionRate`, `responseRate`, session counters, streak, weekly progress
  - Session events update reliability metrics and retention counters
  - Auth middleware now blocks access for temporarily suspended users
  - Trust score now includes completion/response components

### Backend files updated in this block
- `server/src/models/Report.js`
- `server/src/models/User.js`
- `server/src/middlewares/auth.js`
- `server/src/utils/trust.js`
- `server/src/controllers/reportController.js`
- `server/src/controllers/adminController.js`
- `server/src/controllers/sessionController.js`
- `server/src/routes/adminRoutes.js`

### Frontend files updated in this block
- `client/src/features/admin/adminSlice.js`
- `client/src/pages/AdminPage.jsx`

### API changes in this block
- `PATCH /api/admin/reports/:id`
- `PATCH /api/admin/users/:id/suspend`
- `PATCH /api/admin/users/:id/unsuspend`
- Enhanced `POST /api/reports` with duplicate-report cooldown and optional `category`/`priority`

### Validation done
- Backend import validation passed (`node -e "import('./src/app.js')"`)
- Frontend production build passed (`npm run build`)
- No linter errors reported for edited paths

### Phase B continuation (this iteration)
- Added **dashboard retention widgets**: streak, weekly goal progress, reliability metrics, and recent session timeline.
- Added **admin risk operations**:
  - high-risk user filter
  - trust score column
  - credit balance column
  - manual credit adjustment action from Admin UI
- Backend now serves richer dashboard payload:
  - `recentSessions`
  - `streakDays`, `weeklyGoalTarget`, `weeklyGoalProgress`, `completionRate`, `responseRate`
- Admin users endpoint now supports `risk=high` and returns trust metadata.

### Chat → collaboration workspace (this iteration)
- **Schema (`Conversation`)**: `pinnedGoal`, `sessionNotes`, `meetingLink`, `sessionSummary`, `checklist[]`, `activityLog[]`.
- **API**: `PATCH /api/chats/:conversationId/workspace` (validated with Zod), emits `workspace_update` over Socket.io to room `conv:<id>`.
- **Socket**: `emitToConversation` helper; clients join/leave conversation rooms when selecting a chat.
- **Frontend**: `updateWorkspace` thunk, `mergeWorkspaceUpdate` for realtime sync; Chat page layout with sidebar + messages + workspace panel (goal, link, notes, checklist, summary, activity); typing indicators wired to existing `typing` / `typing_stop` events; marks conversation read on open.
