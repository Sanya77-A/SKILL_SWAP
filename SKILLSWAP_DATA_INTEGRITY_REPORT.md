# SkillSwap Data Integrity Report

Date: 2026-08-23

## Wallet Invariants

The immutable transaction ledger is authoritative. `Wallet.balance` is a cached projection and `getWalletSnapshot` recalculates ledger balance, earned, and spent values to expose `integrityValid`. Debits use one conditional `$inc` with `balance >= spend`; operations and transactions have unique idempotency keys. Rewards and refunds first require the canonical booking spend and use booking-derived keys.

Verified cases include simultaneous spends, positive rewards, duplicate/replayed operations, insufficient balance, altered amounts and users ignored in favor of server-owned booking terms, duplicate completion, double refund, and role-gated admin adjustments. The test suite checks one successful concurrent spend, one rejection, one ledger debit, and a non-negative reconciled wallet.

## Booking Invariants

- Teacher and student cannot overlap any 15-minute reservation.
- A proposal leg/sequence can create at most one booking.
- Teacher, student, skill, price, credits, duration defaults, and payment model come from the accepted proposal.
- Past dates and invalid timezones are rejected before service execution.
- Terminal state is single-winner and replay safe.
- Only a completed canonical booking unlocks one review per reviewer/session.

## Concurrency Tests

Two parallel booking POSTs targeting the same participants/time produce one 201 and one 409. A concurrent completion/no-show race produces one 200 and one 409, leaving exactly one terminal state. Rescheduling reserves only net-new token-owned slots, compares the booking version/state, removes its own reservations if it loses, and releases obsolete slots only after the booking update wins.

## Fixes

- Replaced terminal read/save transitions with atomic conditional updates.
- Added single-winner dispute state claim plus orphan-dispute compensation.
- Made reschedule slot handoff versioned and token-owned.
- Fixed nullable review uniqueness with a partial index migration.
- Added retry-safe chat identifiers because durable messaging is also a data-integrity concern.

## Remaining Risks

Standalone MongoDB leaves a narrow process-crash window between wallet projection and ledger insertion despite compensation. Production should use a replica set and transaction/outbox strategy. Booking creation can leave orphan slots after a hard process kill between reservation and booking insert; add scheduled reconciliation. Paid checkout remains unavailable, so no payment integrity claim is made.
