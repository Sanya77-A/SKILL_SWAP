# SkillSwap Security Audit

Date: 2026-08-23

## Outcome

No known Critical, High, Moderate, or Low npm advisories remain in either the complete server or client dependency graph. Both `npm audit --json` reports contain zero total vulnerabilities after explicit non-forced updates plus reviewed major upgrades for Nodemailer 9, React Router 7, and Vite 8.

No unresolved Critical or High application finding remains in the reviewed surface.

## Controls verified or remediated

- Authentication uses HTTP-only Secure cookies in production; JavaScript token persistence is disabled. Access and refresh JWTs use distinct validated secrets and bounded roles remain database-authoritative.
- Refresh credentials are hashed at rest, rotate into a persistent token family, and revoke every still-active family member when a rotated token is reused. Logout, password reset/change, session revocation, account disablement, and soft deletion invalidate access as designed.
- Production startup rejects missing credentials, short/default/shared JWT secrets, non-HTTPS or path-bearing client origins, browser token exposure, weak analytics salt, invalid AI providers, partial SMTP/Cloudinary groups, unsafe SMTP headers, invalid Mongo schemes, ports, and log levels.
- CORS is an explicit production allowlist. Cookie-authenticated unsafe methods require an allowed Origin, cross-site Fetch Metadata is rejected, and endpoint-specific plus global rate limits return stable errors.
- Every protected write route was traced to authentication and its domain ownership or RBAC boundary. Five-role administrator capabilities and rank invariants prevent self/equal/higher-role mutation and all moderation/account/content actions retain immutable audits.
- SkillCredits use an immutable ledger, unique operation/idempotency keys, atomic conditional debits, non-negative balances, compensation, and replay-safe booking/group-session settlement. Paid bookings and group sessions fail closed until an authoritative payment provider exists.
- Socket.IO uses current patched transports, authenticated active accounts, a 100KB packet ceiling, bounded event rate, validated identifiers/payload shapes, participant-only rooms, block/contact checks, and safe failure events without token logging.
- Upload names are server-generated UUIDs. Count and byte limits, exact extension/MIME maps, and file-signature inspection cover JPEG/PNG/GIF/WebP/PDF/DOC/DOCX/TXT; invalid or unpersisted files are removed. Non-image local files are forced to download and Helmet supplies `nosniff` and browser security headers.
- External links accepted from profiles, evidence, projects, communities, challenges, sessions, and skills are limited to HTTP(S), preventing executable `javascript:`/`data:` links. React escapes user text and no raw HTML rendering sink was found.
- API parsing is capped at 10KB, Mongo operator keys are sanitized, Zod schemas bound identifiers, strings, arrays, numbers, states, filters, and pagination, and public/private serializers prevent credential and account-state leakage.
- AI is disabled by default. Providers use fixed endpoints, bounded timeouts/retries/output, minimized grounded context, strict structured parsing, per-user rate limits, normalized errors, and never control balances, matches, ratings, eligibility, or authorization.
- JSON operational logs have constrained request IDs and recursively redact passwords, cookies, authorization headers, tokens, secrets, credentials, API keys, JWT-shaped strings, and circular data. Bodies and query values are not logged.
- Email rendering escapes user-controlled names and links; Nodemailer file/URL access is disabled.

## Verification evidence

- Final post-hardening backend regression: 33 suites, 106 tests, 0 failures.
- Focused security regression: auth, refresh reuse, admin hierarchy, booking/payment fail-closed, wallet concurrency, upload-signature rejection, socket auth, URL schemes, AI contracts, and observability all passed.
- Production client build: Vite 8 build passed with route splitting and no oversized-chunk warning.
- Complete server dependency audit: 0 vulnerabilities.
- Complete client dependency audit: 0 vulnerabilities.
- Valid production configuration imports; deliberately unsafe configuration fails before startup.

## Residual Medium/Low operational risks

- File signatures do not replace antivirus/content-disarm scanning. Before public Internet launch, route document uploads through a quarantined object store plus asynchronous malware scanner and release only clean objects. Current limits, download disposition, signatures, and authentication reduce but do not eliminate malicious-document risk. Severity: Medium.
- Credit compensation is tested on standalone MongoDB, but replica-set transaction aborts and process-kill failure injection are not exercised locally. Use MongoDB transactions and reconciliation alerts in a replica-set staging environment before monetary conversion. Severity: Medium.
- Socket limits are process-local. Multi-instance production needs a shared Socket.IO adapter and distributed rate limiting. Severity: Medium at horizontal scale, Low for one instance.
- Access-token revocation is naturally bounded by the configured short expiry; immediate account-state checks occur on each HTTP/socket authentication, but already-authenticated socket disconnect propagation across future multi-instance nodes needs a shared control channel. Severity: Low.
- Password policy is length-bounded and lockout-protected but does not consult a breached-password corpus. Add privacy-preserving breached-password screening when an external security service is approved. Severity: Low.

These items require deployment infrastructure or external services not present in this repository; none justify silently simulating protection in application code.
