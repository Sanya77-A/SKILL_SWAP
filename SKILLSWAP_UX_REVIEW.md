# SkillSwap UX Review

Date: 2026-08-23

## Journeys Tested

- Signed-out visitor: landing, registration entry, login, password recovery, public listing/profile, certificate verification.
- Learner Samira: dashboard, discovery, match rationale, proposal, booking, chat, credits, learning, safety, settings.
- Mentor and admin paths were reviewed against their existing walkthrough fixtures and role guards.

## Friction Found

- The first screen explained exchange and credits but omitted paid mentoring and the fact that checkout is unavailable locally.
- The dashboard prioritized totals and a chart rather than the next decision.
- Chat optimistically erased unsent content with no recovery.
- Operational/admin users could appear in cached suggestions before backend role filtering.
- “Legacy Requests” and “Legacy Sessions” were visible in the main navigation.

## Changes Made

- Rewrote landing copy to name skill exchange, SkillCredits, and paid mentoring while accurately disclosing fail-closed checkout.
- Rebuilt the dashboard around six useful items: next session, current learning, pending proposal, balance/integrity, one unread notification, and one recommended mentor with factor-derived reasons.
- Added a dashboard-level error state and kept empty states actionable.
- Chat now waits for persistence, restores text/files after failure, reports the failure, and uses retry-safe message IDs.
- Removed legacy workflows from primary navigation while retaining their routes for existing deep links.
- Blocked users and operational roles no longer surface in recommendations.

## Marketplace, Booking, Messaging, and Trust Review

Discovery has bounded search/filter/sort controls, explanatory match factors, empty results, and mobile-friendly cards. Booking confirmation exposes mentor, skill, UTC-derived local time, IANA timezone, duration, mode, credits/payment terms, and state; paid terms fail closed. Trust evidence is concentrated on profile/detail surfaces: verification, rating count, sessions, and report/block controls are present without putting every metric on every card. Chat separates conversation selection, receipts, attachments, cards, typing, and report controls, though a future compact mobile thread switcher would improve very long conversation lists.

## Remaining Opportunities

- Add a dedicated browser E2E suite for onboarding refresh/back/partial completion.
- Consider a user-customizable dashboard after usage data exists.
- Add a payment provider only with authoritative checkout, webhook, refund, and reconciliation states.
