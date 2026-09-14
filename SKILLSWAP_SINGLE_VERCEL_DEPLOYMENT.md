# SkillSwap Single-Project Vercel Deployment

Deployment architecture date: 2026-08-24

## Decision

Deploy the repository root as one Vercel project:

```text
https://<project>.vercel.app/             -> client/dist/index.html (Vite SPA)
https://<project>.vercel.app/assets/*     -> Vite static assets
https://<project>.vercel.app/api/*        -> api/index.js -> Express -> MongoDB
```

This deployment supports the complete REST application: authentication, profiles, discovery, bookings, SkillCredits, reviews, messaging REST, admin APIs, and optional AI/SMTP integrations. Traditional process-owned Socket.IO is deliberately not attached to the Vercel Function. See **Realtime** below.

## Vercel project settings

| Setting | Value |
|---|---|
| Root Directory | Repository root (leave blank / `.`) |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `client/dist` |
| Node.js | 24.x, or another release satisfying `>=20.19.0` |

Do not select `client` as the Root Directory. Root npm workspaces install the client, server, and root tooling from one lockfile.

The authoritative configuration is `vercel.json`. Remove dashboard overrides that disagree with it before redeploying.

## Function architecture and routing

`api/index.js` is the only Vercel Function entry. It:

1. restores the original `/api/...` path supplied by the Vercel rewrite;
2. awaits a cached Mongoose connection;
3. passes the original request and response to the exported Express app;
4. never calls `listen()` and never imports `server/src/server.js`.

The existing `server/src/app.js` remains the single middleware and route composition root. No routes are duplicated.

The rewrites are ordered so `/api/:path*` reaches `api/index.js` before the SPA fallback. The fallback explicitly excludes `/api`, so POST requests cannot be rewritten to `index.html`.

Both `/api` and `/api/v1` are still mounted by Express. New integrations should prefer `/api/v1`; the frontend currently uses `/api`.

## Root workspaces

The root `package.json` declares `client` and `server` as npm workspaces. A fresh deployment needs only:

```bash
npm ci
npm run build
```

The root lockfile contains all frontend and backend production dependencies. Nested lockfiles remain usable by the standalone Docker/Render alternative, but Vercel uses the root lockfile.

## Required production environment variables

Configure these in Vercel Project Settings -> Environment Variables for Production. Apply them to Preview only when that environment is intentionally connected to non-production services.

| Variable | Requirement |
|---|---|
| `DATABASE_MODE` | Explicitly `mongo` for persistence or `demo` for the isolated read-only showcase |
| `MONGO_URI` | Required only in `mongo` mode; use a managed URI and never expose it to the client |
| `MONGO_MAX_POOL_SIZE` | Optional, defaults to `10` per warm Function instance |
| `JWT_ACCESS_SECRET` | Unique random value of at least 32 characters |
| `JWT_REFRESH_SECRET` | Different random value of at least 32 characters |
| `ANALYTICS_SALT` | Separate random value of at least 32 characters |
| `CLIENT_URL` | Exact production origin, e.g. `https://skillswap-nine-jet.vercel.app` |
| `AUTH_EXPOSE_ACCESS_TOKEN` | `false` |
| `AI_PROVIDER` | `disabled`, `openai`, `gemini`, or `groq` |

Vercel supplies `NODE_ENV=production` to the runtime. Do not add a project-level `NODE_ENV` override because it can make the install step omit frontend build dependencies.

`CRON_SECRET` is optional; when absent, scheduled processing is disabled and its endpoint returns 503. Cloudinary is optional for core application use; configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` together to enable durable uploads. When AI is enabled, also set `AI_MODEL` and the selected provider key. SMTP remains an optional all-or-none `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` group.

Do not create `VITE_` variables containing secrets. `VITE_API_URL` should be **unset** for this same-origin deployment. `VITE_SOCKET_URL` should also remain unset unless a separately verified realtime service exists.

Vercel supplies `VERCEL_URL` for the current deployment. The backend adds that exact generated origin to CORS/CSRF trust, allowing preview deployments without trusting wildcard `*.vercel.app` origins. `CLIENT_URL` remains the stable production/reset-link origin.

## Database modes

`DATABASE_MODE=mongo` is the durable production mode. `MONGO_URI` is mandatory in this mode. Vercel-local values such as `localhost` and `127.0.0.1` are rejected before Mongoose attempts a connection. Invalid or unreachable databases return a controlled `503 DATABASE_CONFIGURATION_ERROR` or `503 DATABASE_UNAVAILABLE`; the Function process does not silently enter demo mode.

`DATABASE_MODE=demo` is an explicit, non-persistent showcase. It does not initialize Mongoose and does not require `MONGO_URI`. Dedicated `/api/demo/*` routes provide fictional profiles, listings, dashboard metrics, learning progress, notifications, and short-lived demo identities. All normal persistent APIs return `503 PERSISTENCE_UNAVAILABLE`, including registration, password login, booking, wallet, and admin mutations. Demo Admin is a presentation identity with no real admin role or permissions.

For an immediate demo deployment, configure:

```text
DATABASE_MODE=demo
JWT_ACCESS_SECRET=<unique random value of at least 32 characters>
JWT_REFRESH_SECRET=<different random value of at least 32 characters>
CLIENT_URL=https://skillswap-nine-jet.vercel.app
ANALYTICS_SALT=<separate random value of at least 32 characters>
AUTH_EXPOSE_ACCESS_TOKEN=false
AI_PROVIDER=disabled
```

Leave `MONGO_URI` unset. Real persistence is not available in this mode.

## MongoDB connection management

The database service keeps one connection promise per warm Function instance:

- concurrent cold-start requests share the same pending connection;
- an established connection is reused;
- a failed attempt enters a short backoff so repeated requests do not hammer an unavailable service;
- requests do not disconnect Mongoose;
- the pool defaults to ten connections per Function instance.

Choose a Vercel Function region near MongoDB and size the Atlas connection limit for the possible number of warm instances. Run `npm run migrate:hardening --workspace=server` once from a trusted environment before production traffic; index migration is not performed during Function startup.

## Authentication, cookies, CORS, and CSRF

Production cookies are host-only, `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`. Because the SPA and API share one origin, third-party cookie behavior is no longer required.

The frontend Axios client uses relative `/api` requests with credentials. CSRF protection checks the exact request Origin for unsafe methods. Production cookie-authenticated mutations without an Origin fail closed. Credentialed wildcard CORS is not used.

## Scheduled work

The Function entry never imports the traditional server timer. Vercel Cron invokes:

```text
GET /api/internal/jobs/match-cache
```

daily at 03:00 UTC when `CRON_SECRET` is configured. Vercel sends `Authorization: Bearer $CRON_SECRET`; the route returns 503 when the feature is disabled and fails closed on an incorrect secret. A MongoDB lock prevents overlapping/duplicate recomputations, and the cache write itself is derived/idempotent.

Vercel Hobby cron schedules may run only once per day. On Pro, the schedule may be changed to `0 */12 * * *` to reproduce the old twelve-hour cadence. Large datasets may outgrow the Function duration and should move this job to a durable worker.

## Uploads

Multer stages files under the runtime temporary directory only for signature validation, then uploads them to Cloudinary. Production no longer serves local `/uploads` files. Without complete Cloudinary credentials, core APIs remain available while upload attempts return a controlled 503 and their temporary files are removed.

Vercel Functions have a 4.5 MB request-body limit. SkillSwap caps individual server uploads and browser-selected attachment totals at 4 MB. Larger uploads require a future direct-to-Cloudinary signed upload flow.

## Realtime

The REST application is Vercel-ready; the existing Socket.IO architecture is not.

The traditional server stores rooms, presence, typing, WebRTC signaling, and REST-to-socket emissions in one process. Vercel may place connections and REST invocations on different Function instances, and this repository has no Redis adapter/pub-sub bridge. Therefore:

- production Socket.IO is disabled when `VITE_SOCKET_URL` is unset;
- messaging continues through REST and the chat view polls every ten seconds;
- live presence, typing indicators, instant notifications, and WebRTC calls are unavailable in the Vercel-only deployment;
- call controls are disabled rather than failing silently.

Do not point `VITE_SOCKET_URL` at an arbitrary Socket.IO host. A future realtime service must add shared pub/sub for events created by Vercel REST invocations, distributed rooms/presence, reconnect testing, and authorized call signaling.

## Other production limitations

- `express-rate-limit` memory stores are per Function instance, not global. Account lockout and route authorization remain active, but high-traffic production should use a distributed rate-limit store.
- Function duration and payload limits apply to AI calls, bulk match recomputation, and exports.
- Paid checkout intentionally remains disabled until payment webhooks and reconciliation are implemented.
- Deployment readiness does not prove production behavior until the actual Vercel URL, MongoDB, Cloudinary, and browser session are tested.

## Deployment procedure

1. Push the reviewed commit to the connected GitHub branch.
2. Import the repository into one Vercel project and leave Root Directory blank.
3. Set Node.js 24.x and remove conflicting install/build/output overrides, or set them exactly as shown above.
4. Add every required server environment variable. Leave `VITE_API_URL` and `VITE_SOCKET_URL` unset.
5. Configure the Function region near MongoDB.
6. Run the hardening migration once against the production database.
7. Deploy without reusing configuration from the former client-root project.
8. Verify `/api/health` returns JSON with `database: connected`.
9. Test register, login, refresh, protected profile, logout, bookings, SkillCredits, reviews, messaging REST, and admin denial/allow behavior.
10. Confirm deep links serve the SPA and API POST requests never return HTML or 405.
11. If enabled, verify Cloudinary uploads and the Cron Jobs dashboard entry; otherwise verify both features return their controlled disabled responses.

## Production smoke checklist

- [ ] `/` and a React Router deep link return the SPA
- [ ] `/assets/*` returns static assets
- [ ] `/api/health` returns JSON and a connected database
- [ ] `/api/not-a-route` returns the Express JSON 404, not `index.html`
- [ ] register/login set `Secure; HttpOnly; SameSite=Lax` cookies
- [ ] refresh rotates the hashed refresh-token family
- [ ] protected profile and logout work in one browser session
- [ ] foreign-origin mutations fail CSRF validation
- [ ] booking and SkillCredit state transitions remain authorized/idempotent
- [ ] non-admin users cannot access admin APIs
- [ ] profile/chat uploads return durable Cloudinary URLs and survive new deployments
- [ ] the cron endpoint rejects manual unauthenticated requests
- [ ] browser console has no `/api/api`, CORS, mixed-content, or Socket.IO retry errors

References:

- <https://vercel.com/docs/frameworks/frontend/vite>
- <https://vercel.com/docs/routing/rewrites>
- <https://vercel.com/docs/functions>
- <https://vercel.com/docs/cron-jobs/manage-cron-jobs>
- <https://vercel.com/docs/vercel-blob/server-upload>
