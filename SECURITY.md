# SkillSwap — Security

## Authentication

### JWT and HTTP-only cookies

- **Access token**: Short-lived (15 minutes). Stored in HTTP-only cookie `accessToken` (and optionally sent in `Authorization: Bearer` for non-browser clients).
- **Refresh token**: Long-lived (7 days). Stored in HTTP-only cookie `refreshToken` and in DB (`RefreshToken`). Not exposed to JavaScript, reducing XSS token theft risk.

### Refresh token rotation

- On each `/api/auth/refresh`, the server:
  1. Validates the refresh token (cookie or body).
  2. Deletes the used refresh token from the DB.
  3. Issues a new access token and a new refresh token.
  4. Sets both in HTTP-only cookies.
- Old refresh tokens cannot be reused (one-time use).

### Verification middlewares

- **verifyAccessToken (protect)**: Reads access token from cookie or `Authorization` header, verifies JWT, loads user, blocks if user is deleted/blocked.
- **verifyRefreshToken**: Reads refresh token from cookie or body, checks existence and expiry in DB, verifies JWT; used only on refresh and logout.

### Logout

- Logout endpoint deletes the refresh token from the DB and clears `accessToken` and `refreshToken` cookies. Client cannot reuse the same refresh token.

## Threat prevention

- **NoSQL injection**: `express-mongo-sanitize` strips `$` and `.` from user input used in queries.
- **XSS**: `xss-clean` sanitizes request body. Frontend should still escape/sanitize user-generated content when rendering.
- **CSRF**: SameSite cookies and CORS limit cross-site abuse; state-changing operations require valid JWT in cookie or header.
- **Brute force**: `express-rate-limit` on auth routes (e.g. 10 requests per 15 minutes per IP).

## Configuration

- Use strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in production (min 32 chars).
- Set `NODE_ENV=production`; cookies use `secure: true` in production.
- Restrict `CLIENT_URL` in CORS to your real frontend origin.
