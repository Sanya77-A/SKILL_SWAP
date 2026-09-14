# SkillSwap Backend Production Deployment

> Alternative architecture only: the primary repository deployment is now the root-level Vercel SPA + REST Function described in `SKILLSWAP_SINGLE_VERCEL_DEPLOYMENT.md`. Use this long-running-host guide only when full Socket.IO presence, typing, notifications, and calls are required.

## Decision

**Option C: do not deploy the complete backend to Vercel Functions.**

Deploy the Vite frontend on Vercel and keep Express + Socket.IO together on one long-running Node web service. The repository includes a Render Blueprint (`render.yaml`) for that service.

The compatibility rationale is documented in `SKILLSWAP_VERCEL_BACKEND_AUDIT.md`.

## Production architecture

```text
Browser
  -> https://skillswap-nine-jet.vercel.app            (Vercel frontend)
  -> https://<backend-origin>/api                     (Express REST)
  -> https://<backend-origin>/socket.io               (Socket.IO)

Backend
  -> MongoDB Atlas                                    (authoritative data)
  -> Cloudinary                                       (durable uploads)
  -> SMTP / selected AI provider                      (optional)
```

REST and Socket.IO deliberately use the same backend origin and process. Leave `VITE_SOCKET_URL` unset unless the realtime architecture is intentionally split in the future.

## Backend project settings

### Render Blueprint (repository configuration)

| Setting | Value |
|---|---|
| Repository root | repository root containing `render.yaml` |
| Runtime | Node web service |
| Build command | `cd server && npm ci --omit=dev` |
| Start command | `cd server && npm start` |
| Health check | `/api/health` |
| Node process | `node src/server.js` through `npm start` |

For a manually created service whose Root Directory is `server`, use `npm ci --omit=dev` and `npm start` without the `cd server` prefix.

The included Dockerfile uses Node 20 and the test suite is exercised on Node 20 in CI. Local verification also passes on Node 24. No backend build/output directory is required.

## Required backend environment variables

Never commit these values. The Render Blueprint marks secrets as dashboard-supplied values.

| Variable | Requirement |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Production MongoDB URI |
| `JWT_ACCESS_SECRET` | Unique random value, at least 32 characters |
| `JWT_REFRESH_SECRET` | Different unique random value, at least 32 characters |
| `ANALYTICS_SALT` | Separate random value, at least 32 characters |
| `CRON_SECRET` | Random value, at least 16 characters |
| `CLIENT_URL` | `https://skillswap-nine-jet.vercel.app` |
| `AUTH_EXPOSE_ACCESS_TOKEN` | `false` |
| `CLOUDINARY_CLOUD_NAME` | Production Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Production Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Production Cloudinary API secret |

The host injects `PORT`. Optional complete groups are:

- SMTP: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, plus optional port/secure/from settings
- AI: set `AI_PROVIDER` to `openai`, `gemini`, or `groq`, then provide `AI_MODEL` and the matching provider key

Use `AI_PROVIDER=disabled` when no provider is configured.

## Frontend integration

In the Vercel frontend project, set:

```text
VITE_API_URL=https://<actual-backend-origin>
```

Use the backend origin without `/api`. The client normalizes either an origin or a value already ending in `/api`, so it never generates `/api/api`. Production builds now fail when `VITE_API_URL` is missing, preventing a silent fallback to the frontend's own Vercel domain.

`VITE_SOCKET_URL` is optional. Leave it unset for the selected unified backend; Socket.IO derives the origin from `VITE_API_URL`.

## CORS and CSRF

- Express CORS and Socket.IO use the same exact-origin allowlist from `CLIENT_URL`.
- Credentialed requests are enabled; wildcard origins are not used.
- The deployed frontend origin is `https://skillswap-nine-jet.vercel.app`.
- Unsafe requests from an allowlisted Origin pass even when the browser reports `Sec-Fetch-Site: cross-site`.
- Foreign origins fail.
- Cookie-authenticated production mutations with no Origin fail.
- OPTIONS preflight requests are allowed and tested.

Preview URLs must be added explicitly as comma-separated `CLIENT_URL` origins. Do not add wildcard `*.vercel.app` trust.

## Cookies and authentication

Production access and refresh cookies are:

- `HttpOnly`
- `Secure`
- `SameSite=None`
- host-only (no broad `Domain` attribute)
- `Path=/`

The frontend Axios client and Socket.IO use credentialed requests. Refresh tokens remain hashed in MongoDB and rotate on refresh.

Because `vercel.app` and a typical `onrender.com` backend are different sites, browser policies that block third-party cookies can still prevent cross-site cookie auth. The most reliable long-term production arrangement is custom domains under one registrable site, for example `app.example.com` and `api.example.com`, followed by updating `VITE_API_URL` and `CLIENT_URL` together.

## MongoDB

The traditional server connects before it begins listening and reuses that Mongoose connection for the process lifetime. Configure the database network allowlist for the backend host and choose a region close to MongoDB.

Do not disconnect after requests. Startup failures terminate the process so the hosting platform can restart it. The current helper is not a Vercel Function connection cache and must not be presented as one.

## Socket.IO

Socket.IO remains attached to the same HTTP server as Express. This preserves:

- cookie/JWT socket authorization;
- per-user and per-conversation rooms;
- online presence;
- messages and notifications emitted by REST controllers;
- typing and read-receipt events;
- WebRTC offer/answer/ICE/hangup signaling.

For one backend instance this architecture is valid. Before horizontal scaling, add a Socket.IO Redis adapter/shared presence model and validate transport affinity and controller event delivery across instances.

## Scheduled jobs

The process recomputes derived match caches every 12 hours. The operation sets/upserts derived state and is safe to repeat, but the in-process timer assumes one continuously running instance.

If the backend scales beyond one instance, move this operation to an authenticated external scheduler and add a distributed lock. Do not schedule SkillCredit increments or other non-idempotent mutations through an unguarded job.

## Uploads

Multer temporarily writes files for signature validation and then uploads them to Cloudinary. Cloudinary credentials are required in production. The `/uploads` path remains a development fallback and must not be treated as durable production storage.

No paid or new storage provider was added; the existing Cloudinary integration is reused.

## Known limitations

- A real production MongoDB URI and Cloudinary credentials are external blockers.
- No deployed backend URL exists yet, so cross-origin browser auth and Socket.IO cannot be production-verified.
- Third-party cookie blocking may require same-site custom domains.
- The current scheduler and Socket.IO presence model assume one backend instance.
- Realtime delivery has not been verified on Vercel Functions and is intentionally not claimed.

## Dashboard deployment steps

1. In Render, create a Blueprint from this GitHub repository or create one Node web service using the settings above.
2. Supply `MONGO_URI`, both JWT secrets, `ANALYTICS_SALT`, and all three Cloudinary values.
3. Confirm `CLIENT_URL=https://skillswap-nine-jet.vercel.app` and `AUTH_EXPOSE_ACCESS_TOKEN=false`.
4. Deploy the backend and verify `https://<backend-origin>/api/health` reports `status: ok` and `database: connected`.
5. In the Vercel frontend project, set `VITE_API_URL=https://<backend-origin>` for Production. Leave `VITE_SOCKET_URL` unset.
6. Redeploy the frontend after the environment variable is saved.
7. Execute the production checklist below from a clean browser session.

## Production test checklist

- [ ] `GET /api/health` is 200, reports connected, and exposes no configuration
- [ ] allowed-origin preflight returns the exact frontend origin and credentials header
- [ ] foreign-origin mutation is rejected
- [ ] register sets Secure, HttpOnly, SameSite=None cookies
- [ ] login succeeds from the deployed frontend
- [ ] refresh rotates the refresh token
- [ ] protected profile loads
- [ ] logout revokes the current refresh token
- [ ] booking create/confirm/reschedule/complete authorization works
- [ ] SkillCredit balance and idempotent mutations work
- [ ] messaging REST creates and reads messages
- [ ] two authenticated browsers connect to Socket.IO
- [ ] user/conversation rooms, presence, typing, message, read receipt, and reconnect work
- [ ] WebRTC signaling reaches the intended authorized user only
- [ ] non-admin users cannot access admin routes
- [ ] profile and chat uploads survive a backend restart
- [ ] browser console/network contains no CORS, CSRF, cookie, mixed-content, or `/api/api` errors

Do not report deployment success until these checks run against the actual backend URL.
