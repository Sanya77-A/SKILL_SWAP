# SkillSwap Performance Report

Date: 2026-08-23

## Dataset and Method

`npm run benchmark:hardening` creates an isolated, deterministic local database, measures seven warm samples per query, records `executionStats`, then removes that database. Dataset: 2,000 users, 200 skills, 4,000 listings, 5,000 bookings, 10,000 reviews, 20,000 messages, 8,000 user-skill records, 10,000 notifications, and 1,000 conversations. This is moderate development scale, not a production load test.

## Benchmarks

| Query | Median ms | Docs / keys examined | Returned | Plan |
| --- | ---: | ---: | ---: | --- |
| Explore mentors | 0.76 | 20 / 21 | 20 | indexed |
| Skill search/order | 0.46 | 20 / 20 | 20 | indexed |
| Listing filters | 1.01 | 20 / 20 | 20 | indexed |
| Public profile | 0.45 | 1 / 1 | 1 | indexed |
| Match candidates | 0.77 | 40 / 40 | 40 | indexed |
| Booking calendar | 0.45 | 1 / 1 | 1 | indexed |
| Notifications | 0.50 | 3 / 3 | 3 | indexed |
| Conversation history | 0.58 | 20 / 20 | 20 | indexed |

## Frontend Bundle

The Vite 8 build transformed 2,444 modules. Entry: 246.06 kB raw / 78.41 kB gzip. CSS: 35.31 / 7.49 kB gzip. Feature routes are lazy chunks. The largest route is mentor analytics at 307.15 / 89.34 kB gzip because Recharts is isolated there. Chat is 63.48 / 19.69 kB gzip. No oversized-chunk warning occurred.

## Improvements

- Existing route splitting keeps admin, communities, AI, chat, learning, and analytics out of the landing entry.
- Compound indexes align with candidate, listing, booking, notification, review, conversation, and message sort/filter paths.
- Pagination and projections bound high-growth responses; compression is enabled.
- The benchmark is reproducible and does not pollute development data.

## Remaining Scaling Limits

Regex user search and multi-section Explore will need Atlas Search or a dedicated search index at larger scale. Match recomputation is application-memory work and should move to jobs as candidate counts grow. Socket.IO, rate limiting, and presence are single-process. Cache invalidation is TTL-based. Results are local warm-query timings without concurrency, TLS, network, serialization, or UI rendering cost.
