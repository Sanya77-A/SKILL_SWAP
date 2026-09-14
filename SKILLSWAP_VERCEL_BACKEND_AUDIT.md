# SkillSwap Vercel Backend Compatibility Audit

Audit date: 2026-08-24

> Update: the repository now supports a single-project Vercel deployment for the SPA and REST API. The rejection below still applies to the **complete traditional backend**, specifically Socket.IO and process-owned jobs. See `SKILLSWAP_SINGLE_VERCEL_DEPLOYMENT.md` for the implemented REST Function architecture and its explicit realtime limitations.

## Executive decision

**Historical full-backend decision: Option C — do not deploy the traditional Socket.IO server unchanged to Vercel Functions.**

Vercel can currently detect and run an exported Express app, and its WebSocket support entered public beta in June 2026. Those capabilities do not make the current SkillSwap backend safe on Vercel without a larger realtime and worker refactor. SkillSwap's REST controllers, Socket.IO rooms, presence, call signaling, scheduled work, and upload flow assume one continuously running Node process.

The minimum safe production architecture is:

- React/Vite frontend on Vercel
- one unified Express + Socket.IO backend on a long-running web-service/container host
- MongoDB Atlas or another managed MongoDB deployment
- Cloudinary for durable profile and chat uploads

This keeps REST-originated realtime events in the same Socket.IO process and preserves authentication, messaging, calls, booking, SkillCredits, AI, and admin behavior.

## Classification

The labels below describe compatibility with **Vercel Functions**, not general Node hosting.

| Subsystem | Classification | Repository evidence and conclusion |
|---|---|---|
| Express application | COMPATIBLE | `server/src/app.js` creates one Express app, mounts `/api` and `/api/v1`, and exports it without calling `listen`. Vercel can detect exported Express apps. |
| Traditional startup | NOT SUITABLE FOR VERCEL FUNCTIONS | `server/src/server.js` creates an HTTP server, attaches Socket.IO, calls `listen`, owns signal handlers, and closes MongoDB during process shutdown. Keep this entry point for a long-running host. |
| REST routes | COMPATIBLE | Express middleware and route handlers can execute in a Function in isolation, subject to connection, duration, rate-limit, upload, and realtime caveats below. |
| MongoDB models/queries | COMPATIBLE | Mongoose operations use externally persisted MongoDB state. Booking and credit operations already include idempotency/state-transition protections. |
| MongoDB bootstrap | COMPATIBLE AFTER ADAPTATION | `connectDB()` now reuses a cached promise, resets after failure, reconnects after disconnection, and leaves index migration outside request startup. |
| Cookie/JWT authentication | COMPATIBLE | Same-origin production cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, host-only, and scoped to `/`. Axios sends credentials. |
| CORS | COMPATIBLE | Production requires explicit `CLIENT_URL`; wildcard credentialed CORS is not used. Exact frontend-origin and preflight regression tests are present. |
| CSRF protection | COMPATIBLE | Unsafe methods validate `Origin`; cookie-authenticated production mutations require an Origin. Explicitly allowlisted cross-site requests pass, while foreign and missing origins fail. |
| In-memory rate limiting | REQUIRES ADAPTATION | `express-rate-limit` uses per-process memory. On multiple Functions, limits are neither global nor stable. A distributed store would be required. |
| Socket.IO server | NOT SUITABLE FOR VERCEL FUNCTIONS | Socket.IO is attached to the process-owned HTTP server. Rooms, presence, typing, read receipts, calls, and broadcasts assume the connected clients are visible through one `io` instance. |
| Socket authentication | COMPATIBLE | JWT/cookie authentication and MongoDB account checks are valid, but only after a suitable realtime transport is available. |
| Presence and rooms | NOT SUITABLE FOR VERCEL FUNCTIONS | `io.fetchSockets()`, `socket.rooms`, user rooms, and conversation rooms are process/adapter state. Vercel does not guarantee future connections reach the same Function. |
| REST-to-realtime delivery | NOT SUITABLE FOR A SPLIT DEPLOYMENT | Chat and notification controllers call a module-level Socket.IO singleton. A REST Function and external socket service would need Redis/pub-sub or a durable event bus; otherwise message events are lost. |
| WebRTC signaling | NOT SUITABLE FOR VERCEL FUNCTIONS | Offer, answer, ICE, and hangup events target Socket.IO user rooms and require dependable cross-client delivery. Function-instance isolation would break calls without shared realtime state. |
| Reconnect behavior | REQUIRES ADAPTATION | The client reconnects through Socket.IO defaults, but the server has no Redis adapter, connection-state recovery, or distributed presence reconciliation. |
| Twelve-hour match-cache timer | COMPATIBLE AFTER ADAPTATION | The Function does not import the timer. Vercel Cron invokes an authenticated daily endpoint protected by a MongoDB overlap lock. The traditional server retains its timer. |
| Proposal expiration | COMPATIBLE | Expiration is applied idempotently during proposal reads using an update query; it does not depend on the timer. |
| Local upload staging | COMPATIBLE AFTER ADAPTATION | Production Multer staging uses the runtime temporary directory for signature validation, then Cloudinary. It is never treated as durable storage. |
| Cloudinary upload path | COMPATIBLE | Uploaded profile images and chat attachments are copied to Cloudinary and the temporary local file is removed. Cloudinary is now required in production. |
| Static `/uploads` fallback | NOT SUITABLE FOR MANAGED EPHEMERAL HOSTS | This remains a development fallback only. Production startup fails if Cloudinary credentials are missing. |
| AI HTTP integrations | COMPATIBLE | Provider calls are outbound, timeout-bounded, retry-limited, and optional. Function duration would still need monitoring. |
| SMTP/email | COMPATIBLE | Outbound SMTP is optional and configuration is validated as an all-or-none group. |
| Health endpoint | COMPATIBLE | `/api/health` reports status, timestamp, and connected/disconnected database state without exposing configuration. |
| Security headers/sanitization | COMPATIBLE | Helmet, input size limits, Mongo sanitization, XSS cleaning, request IDs, and redacted logging are app middleware. |
| Graceful shutdown | NOT APPLICABLE TO VERCEL FUNCTIONS | Signal handling is correct for a traditional process but is not a Function lifecycle mechanism. |

## Current Vercel model verified

### Express

Vercel's current Express guide states that an exported Express application can run as one Fluid-compute Function with zero configuration when it uses a recognized entry file. SkillSwap's `app.js` is structurally close to that model, but HTTP compatibility alone does not address its process-owned realtime and worker behavior.

Reference: <https://vercel.com/kb/guide/ship-a-express-app-on-vercel>

### WebSockets and Socket.IO

Vercel WebSockets are currently public beta. An established connection is pinned to one Function instance, but future connections are not guaranteed to reach that instance. Vercel's own multi-client chat guidance uses Redis so rooms, messages, and presence can cross Function instances, and its upgrade API is still experimental.

SkillSwap has no Socket.IO Redis adapter or event bus. Two users connected to different Function instances could miss presence, typing, calls, and room broadcasts. REST Function invocations could also run without access to the Function instance holding the recipient's socket.

References:

- <https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections>
- <https://vercel.com/kb/guide/real-time-chat-websockets>

### Scheduling

The match-cache operation writes derived state and can be run repeatedly, but its current `setInterval` cannot be trusted in a scale-to-zero runtime. A future Vercel migration would expose a protected job endpoint, use `CRON_SECRET`, and add a distributed lock because Vercel documents possible overlapping and duplicate cron invocations.

Reference: <https://vercel.com/docs/cron-jobs/manage-cron-jobs>

### Uploads

Profile and chat files require durable object storage. Cloudinary is already integrated, so production now fails fast unless all three Cloudinary credentials are present. No Vercel Blob dependency was added.

## Why hybrid REST-on-Vercel was rejected

A hybrid deployment is not a small configuration change for this repository:

1. REST message creation writes MongoDB and then calls `emitToUser` / `emitToConversation` on a module-local `io` singleton.
2. Notification creation also emits through that singleton.
3. A Vercel REST Function cannot address sockets held by a separate service without shared pub/sub.
4. Adding Redis requires defining delivery, presence, room, retry, and failure semantics and testing them under multiple instances.

Until that work is intentionally funded and tested, splitting the backend would degrade realtime correctness. Keeping REST and Socket.IO together is the smaller and safer architecture.

## Future requirements for full Vercel eligibility

Full backend eligibility would require all of the following:

- a Vercel Function entry that awaits a retry-safe cached MongoDB connection;
- moving legacy index migration out of runtime startup;
- Socket.IO/WebSocket adaptation using a supported Vercel upgrade path;
- Redis-backed rooms, presence, pub/sub, and controller-to-socket events;
- an appropriate sticky/transport strategy for any Socket.IO polling fallback;
- distributed rate limiting;
- an authenticated idempotent cron endpoint with a distributed lock;
- Cloudinary/Vercel Blob/S3-only uploads with no persistent local URLs;
- deployed two-user tests for reconnect, messaging, typing, read receipts, calls, and cross-instance delivery;
- load and duration testing under the selected Vercel plan.

No Vercel backend handler or `server/vercel.json` is added by this audit because doing so would imply unsupported production readiness.
