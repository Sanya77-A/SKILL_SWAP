# SkillSwap

SkillSwap is a full-stack skill-economy marketplace where people discover credible peers, negotiate exchanges, book conflict-safe sessions, collaborate, review outcomes, earn or spend SkillCredits, and turn learning into visible portfolio evidence.

The repository is a domain-oriented MERN monolith: React 18/Vite 8 on the client, Express/Socket.IO on the API, and MongoDB/Mongoose as the source of truth. AI is an optional provider-neutral presentation layer; it never owns scores, balances, eligibility, or authorization.

## What is implemented

- Cookie-based authentication with rotating hashed refresh-token families, reuse detection, lockout, password reset/change, device sessions, privacy controls, and soft deletion.
- Canonical skills, professional profiles, verified evidence, teaching listings, rich discovery, and deterministic explainable matching.
- Versioned swap proposals, UTC/IANA-timezone availability, database-enforced booking conflicts, completion/cancellation/no-show settlement, and structured reviews.
- Relationship-gated realtime chat, safe attachments/cards, durable receipts, notifications, and WebRTC signaling boundaries.
- Immutable SkillCredits ledger, atomic non-negative debits, idempotent rewards/refunds, reconciliation, and audited admin adjustments.
- Skill gaps, editable roadmaps, My Learning projections, communities, group sessions, challenges, XP/badges, certificates, portfolios, mentor analytics, and an activity feed.
- Safety blocks, authoritative reports, booking disputes, moderation history, and a five-role permission/hierarchy model across eleven admin areas.
- Responsive dual-theme UI, accessible primitives/dialogs/tabs/navigation, route-level code splitting, compressed APIs, bounded pagination, and production-grade demo data.

## Screenshots

The repository includes the optimized landing artwork in `client/public/images`. For a portfolio case study, capture the seeded landing, action-first dashboard, explainable discovery result, booking confirmation, SkillCredit ledger, learning roadmap, mentor analytics, and admin moderation views. The demo script below keeps those captures consistent without checking generated screenshots into source control.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- MongoDB 6+ (local or Atlas)
- Optional locally: SMTP, Cloudinary, and one supported AI provider; Cloudinary is required in production

## Local setup

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run seed
npm run dev
```

The root development command starts the API and client together. The repository defaults are API `http://localhost:5003` and client `http://localhost:5174`; set `PORT`, `CLIENT_URL`, and `VITE_API_URL` to use different ports.

For two terminals:

```bash
# Terminal 1
npm run server

# Terminal 2
npm run client
```

## Environment

Start from [server/.env.example](server/.env.example). Set `DATABASE_MODE=mongo` for durable persistence or explicitly select `DATABASE_MODE=demo` for the isolated read-only showcase. Production startup fails before binding a listener unless the non-database security invariants are satisfied.

Required in production:

- `DATABASE_MODE` (`mongo` or `demo`; defaults securely to `mongo`)
- `MONGO_URI` when `DATABASE_MODE=mongo`
- distinct random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values of at least 32 characters
- `CLIENT_URL` containing only comma-separated HTTPS origins
- independent `ANALYTICS_SALT` of at least 32 characters

Keep `AUTH_EXPOSE_ACCESS_TOKEN=false`. `CRON_SECRET` is optional; scheduled processing is disabled when it is absent. Cloudinary is also optional, but all three Cloudinary variables must be present to enable durable uploads. AI defaults to `AI_PROVIDER=disabled`; selecting `openai`, `gemini`, or `groq` additionally requires `AI_MODEL` and that provider's API key. SMTP remains optional.

Runtime demo mode never initializes Mongoose and never silently replaces a failed configured database. It exposes only deterministic fictional data through `/api/demo/*`, uses a short-lived `HttpOnly` demo session, and blocks every normal persistent API with `PERSISTENCE_UNAVAILABLE`. Normal registration, password login, bookings, wallets, and administration remain unavailable. This runtime mode is separate from the Mongo-backed seed command below.

## Demo data

```bash
SEED_DEMO_PASSWORD='choose-at-least-12-characters' npm run seed
```

The idempotent seed owns only its deterministic fictional fixtures and never deletes unrelated records. It creates 13 cross-discipline personas, 27 canonical skills, 55 user-skill links, 10 listings, 20 availability rules, five varied bookings, three reviews, wallets plus 19 immutable ledger entries, notifications, three communities, three roadmaps, and three portfolio projects. Reruns update the demo accounts to the selected password and preserve stable relationships. Production seeding requires the explicit `ALLOW_PRODUCTION_SEED=true` acknowledgement.

For legacy databases, the canonical skill migration is idempotent:

```bash
cd server
npm run migrate:phase3
```

## Verification

```bash
cd server
npm test -- --runInBand

cd ../client
npm run build

npm audit
```

Latest verification on 2026-08-24: 40 backend suites / 139 tests passed, the Vite 8 production build passed, and the unified dependency audit reported zero vulnerabilities. The repository has no configured frontend unit-test script; frontend verification is the production build plus the deployed-browser checklist.

## Architecture and source layout

```text
client/src
  app/              Redux store
  components/       shell, feature components, accessible UI primitives
  features/         auth, chat, notifications, requests, users
  pages/            lazy-loaded product routes
  utils/            cookie-aware API client

server/src
  config/           environment, database, CORS, Cloudinary
  controllers/      HTTP adapters
  services/         authoritative domain rules and projections
  models/           Mongoose aggregates, ledgers, memberships, audits
  routes/            version-compatible API composition
  validators/       bounded Zod request contracts
  serializers/      public/private data boundaries
  middlewares/      auth, RBAC, CSRF, rates, uploads, observability
  socket/           authenticated realtime delivery/signaling
  scripts/          migration and deterministic seed
```

Both `/api` and `/api/v1` mount the same router; new integrations should use `/api/v1`. MongoDB remains authoritative and Socket.IO is delivery-only. Paid terms are discoverable and negotiable, but booking/enrollment checkout fails closed until a real payment provider and ledger are configured.

## Deployment checklist

1. Deploy the repository root as one Vercel project using `vercel.json`.
2. Provision MongoDB and Cloudinary, then configure the validated production variables.
3. Leave `VITE_API_URL` unset so the frontend uses same-origin `/api`.
4. Run the hardening migration once, then verify `/api/health` and the production smoke checklist.
5. Keep Socket.IO disabled until shared pub/sub and distributed presence are implemented.
6. Keep paid checkout disabled until provider webhooks, payment/refund ledgers, idempotency, and reconciliation are implemented.

## Documentation

- [Single-project Vercel deployment](SKILLSWAP_SINGLE_VERCEL_DEPLOYMENT.md)
- [Final implementation report](SKILLSWAP_FINAL_IMPLEMENTATION_REPORT.md)
- [Implementation status](SKILLSWAP_IMPLEMENTATION_STATUS.md)
- [Architecture](SKILLSWAP_ARCHITECTURE.md)
- [API documentation](SKILLSWAP_API_DOCUMENTATION.md)
- [Database schema](SKILLSWAP_DATABASE_SCHEMA.md)
- [Security audit](SKILLSWAP_SECURITY_AUDIT.md)
- [Test report](SKILLSWAP_TEST_REPORT.md)
- [Technical audit](SKILLSWAP_TECHNICAL_AUDIT.md)
- [Independent deep audit](SKILLSWAP_DEEP_AUDIT.md)
- [UX review](SKILLSWAP_UX_REVIEW.md)
- [Match evaluation](SKILLSWAP_MATCH_ENGINE_EVALUATION.md)
- [Data integrity](SKILLSWAP_DATA_INTEGRITY_REPORT.md)
- [AI evaluation](SKILLSWAP_AI_EVALUATION.md)
- [Performance](SKILLSWAP_PERFORMANCE_REPORT.md)
- [Accessibility](SKILLSWAP_ACCESSIBILITY_REPORT.md)
- [System flows](SKILLSWAP_SYSTEM_FLOWS.md)
- [Interview mastery](SKILLSWAP_INTERVIEW_MASTERY.md)
- [Demo script](SKILLSWAP_DEMO_SCRIPT.md)
- [Hardening and mastery report](SKILLSWAP_HARDENING_AND_MASTERY_REPORT.md)

## Portfolio Description

SkillSwap is a full-stack peer-learning marketplace that supports direct skill exchange, an internal SkillCredit economy, mentoring terms, conflict-safe booking, relationship-authorized realtime collaboration, and durable learning evidence. It is implemented as a domain-oriented React/Express/MongoDB monolith with deterministic explainable matching, rotating cookie authentication, idempotent ledger operations, atomic booking reservations, grounded provider-neutral AI, and capability-scoped administration. The project emphasizes correctness under retries and concurrency rather than fabricated adoption or scale claims.

## License

MIT
