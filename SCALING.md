# SkillSwap — Scaling

## 100 users

- Single server and single MongoDB instance are sufficient.
- Match cache cron every 12 hours is fine; on-demand recompute on profile change can be added.
- No change to architecture.

## 10k users

- **Database**: Add read replicas for MongoDB; use primary for writes and replicas for read-heavy endpoints (matches, messages list, notifications).
- **API**: Run multiple server instances behind a load balancer (e.g. Nginx or cloud LB). Stick sessions for Socket.io: use Redis adapter for Socket.io so events are broadcast across instances.
- **Match cache**: Keep 12-hour cron; consider queue (e.g. Bull + Redis) to recompute in batches.
- **Files**: Keep Cloudinary for profile and chat attachments; no local disk dependency.
- **Caching**: Add Redis for hot data (e.g. session or rate-limit state if needed).

## 1M users

- **Sharding**: MongoDB sharding by `userId` or by tenant if multi-tenant. Conversations and messages sharded by conversationId or userId.
- **Services**: Split into auth, matches, chat, notifications, sessions. Each service scales independently; communicate via REST or message queue.
- **Socket.io**: Dedicated Socket server(s) with Redis adapter; scale horizontally. Optionally move to a managed real-time provider (e.g. Pusher, Ably).
- **Match cache**: Event-driven recompute (e.g. on profile/skills change) and queue-based batch jobs. Store cache in Redis or a dedicated read store for low latency.
- **Search**: Use MongoDB Atlas Search or Elasticsearch for user/skill search and filters.
- **CDN**: Serve static frontend and assets via CDN; API and WebSocket behind global LB with geo-routing if needed.

## Summary

| Scale   | Approach                                              |
|---------|--------------------------------------------------------|
| 100     | Single server + single MongoDB                        |
| 10k     | Multiple API instances, Redis Socket.io adapter, replicas |
| 1M      | Sharding, service split, event-driven match cache, CDN |
