# SkillSwap — System Architecture

## Overview

SkillSwap is a MERN (MongoDB, Express, React, Node.js) monorepo with a REST API, real-time chat (Socket.io), and server-rendered frontend (React SPA).

## High-Level Design

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Server    │────▶│   MongoDB   │
│  (React)    │     │  (Express)  │     │             │
└─────────────┘     └──────┬──────┘     └─────────────┘
       │                    │
       │                    │ Socket.io
       └────────────────────┘
```

- **Client**: React (Vite), Redux Toolkit, React Router. Proxies `/api` and `/socket.io` to the server in development.
- **Server**: Express, Mongoose, Socket.io. Serves API and WebSocket.
- **Database**: MongoDB. Stores users, swap requests, conversations, messages, notifications, match cache, sessions, reports.

## Authentication Flow

1. **Register / Login**: Client POSTs credentials. Server validates, creates/loads user, issues access token (15m) and refresh token (7d), stores refresh token in DB, sets HTTP-only cookies (`accessToken`, `refreshToken`).
2. **Authenticated requests**: Client sends cookies (or `Authorization: Bearer <accessToken>`). Middleware `protect` (verifyAccessToken) validates JWT and attaches `req.user`.
3. **Refresh**: When access token expires, client POSTs to `/api/auth/refresh` with refresh token (cookie or body). Middleware `verifyRefreshToken` validates and attaches stored token. Controller deletes old refresh token, issues new access + refresh (rotation), sets new cookies.
4. **Logout**: Client POSTs to `/api/auth/logout`. Server deletes refresh token from DB and clears auth cookies.

## Chat Flow

1. **Conversation**: Allowed only between two users who have an ACCEPTED or COMPLETED swap request. `POST /api/chats/conversation` with `otherUserId` creates or returns a conversation.
2. **Messages**: Stored in `Message` collection with `conversation`, `sender`, `content`, optional `attachments` (Cloudinary URLs). Paginated via `GET /api/chats/:id/messages`.
3. **Real-time**: Socket.io authenticates with access token. On connection, user joins room `user:<userId>`. On `send_message`, server persists message, updates conversation `lastMessage` and `unreadCount`, emits `message` to recipient and `notification` for in-app alert.
4. **Unread**: Each conversation has `unreadCount` map (userId → count). Sender increments recipient’s count; `PATCH /api/chats/:id/read` zeros current user’s count.

## Matching System

1. **Score**: `calculateMatchScore(currentUser, targetUser)` returns `{ matchScore, reasons }`:
   - Mutual skill match: +50
   - Rating: ratingAvg * 10
   - Availability overlap: +20
   - Same location: +5
   - Recent activity (updated in last 7 days): +10
2. **Cache**: `MatchCache` stores `userId`, `matchedUserId`, `matchScore`, `reasons`. Cron runs every 12 hours to recompute all caches.
3. **API**: `GET /api/matches` returns `{ data: [{ user, matchScore, reasons }], pagination }`. Frontend shows reason chips (e.g. “Mutual Skill Match”, “High Rating”).

## Sessions (Scheduling)

- **Session** links to a swap `requestId`, has `teacherId`, `studentId`, `proposedSlots[]`, `acceptedSlot`, `status` (PROPOSED → CONFIRMED → COMPLETED).
- Endpoints: `POST /api/sessions`, `PATCH /api/sessions/:id/accept`, `PATCH /api/sessions/:id/complete`, `GET /api/sessions`.

## Notifications

- Stored in `Notification` (userId, type, title, message/link, read). Types include NEW_REQUEST, REQUEST_ACCEPTED, NEW_MESSAGE, SESSION_CONFIRMED, etc.
- Real-time: Server emits `notification` to `user:<userId>` via Socket.io. Client updates Redux and badge count.

## Security

- **Helmet**: Security headers.
- **CORS**: Configured for `CLIENT_URL` with credentials.
- **Rate limiting**: Stricter on auth routes (e.g. 10 req/15 min).
- **Mongo sanitize**: Prevents `$`/`.` in input.
- **XSS clean**: Sanitizes request body.
- **JWT**: Access 15m, refresh 7d, rotation on refresh; refresh tokens stored in DB and invalidated on logout.

## Settings and privacy boundary

- `GET /api/settings` is an authenticated aggregate over account/profile preferences, notification delivery, availability, safe refresh-session metadata, wallet billing status, and explicitly configured external integrations.
- Public user serialization is field-aware: profile visibility gates the profile, while location, online presence, and last-active values have independent disclosure controls.
- Contact permissions are recipient-owned and enforced by the chat service for every persisted send. Existing history remains readable even when later privacy changes prevent further contact.
- Sensitive account mutations require password confirmation. Email changes invalidate email verification; account deletion is a reversible database soft-delete from an infrastructure perspective but immediately anonymizes identity data and revokes all refresh sessions.

## Client design system

- CSS variables own the single cool-neutral palette across dark and light themes. Violet remains the only brand accent; green, amber, and red are reserved for semantic states.
- The shape contract uses 16px cards, 10-12px controls, and circular geometry only for avatars, presence, and icon-only media controls. Elevation is expressed with restrained, background-tinted shadow tokens.
- Shared `Button`, `Card`, `Input`, `Select`, `Tabs`, `Skeleton`, `PageHeader`, `EmptyState`, and `InlineNotice` components own hierarchy and interaction states. Raw page forms use the same elevated input surface.
- The application shell separates grouped desktop navigation, a sticky contextual top bar, and compact mobile navigation. Public and authenticated routes retain their existing information architecture and slugs.
- Theme selection defaults to the operating-system preference when no user choice exists and remains available on signed-out and signed-in surfaces. Motion is limited to feedback and state communication and collapses under `prefers-reduced-motion`.
- The public homepage uses the optimized 83KB project asset at `client/public/images/skillswap-collaboration-hero.webp`; dimensions and descriptive alt text prevent layout shift and preserve meaning.
