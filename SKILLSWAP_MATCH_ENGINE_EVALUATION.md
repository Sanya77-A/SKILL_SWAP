# SkillSwap Match Engine Evaluation

Date: 2026-08-23

## Factors and Weights

| Factor | Weight | Rationale |
| --- | ---: | --- |
| Teaches wanted skill | 30 | Primary learner utility |
| Reciprocal skill | 12 | Makes direct exchange feasible |
| Availability | 12 | A strong match must be schedulable |
| Language | 8 | Supports instruction quality |
| Experience fit | 8 | Prevents underqualified recommendations |
| Goal alignment | 7 | Rewards domain relevance |
| Timezone | 6 | Important for remote scheduling |
| Location | 5 | Useful but must not dominate remote matches |
| Learning mode | 5 | Format preference |
| Reputation | 5 | Trust signal, deliberately below skill fit |
| Price/model | 2 | Tie-breaker because exchange terms can be negotiated |

Weights sum to 100. AI does not assign or alter any score.

## Evaluation Dataset

`matchEvaluation.test.js` contains 30 deterministic cases: reciprocal, one-way, conflicting/missing availability, language match/mismatch, remote and mode compatibility, same/different/unknown location, near/far/unknown timezone, qualified/underqualified mentor, strong reputation with weak skills, sparse reputation with strong skills, aligned/conflicting goals, compatible/expensive credits, direct exchange, unsupported paid-only terms, missing listings/profile data, and mentor-only cases.

## Expected Ordering and Result

The suite asserts ordering rather than brittle exact values. Perfect reciprocal ranks above the same skills with poor availability; skill-compatible sparse-reputation ranks above a five-star irrelevant teacher; shared language outranks mismatch; an advanced teacher outranks an underqualified teacher for an advanced learner; compatible credits outrank over-budget credits; supported exchange outranks unsupported paid-only terms. All three evaluation tests pass after correcting the proficiency fixture to model an advanced learner.

## Normalization and Explainability

Every factor and final score is clamped to 0-100. Missing optional fields receive a neutral 50 where appropriate; absence of a reciprocal teaching need correctly receives 0 because it is not a required one-way mentor signal. Reasons are generated only from named factors scoring at least 60 and sorted by weighted contribution. No personality or fabricated affinity language exists.

## Bugs Fixed

- Bilateral blocks are applied before candidate construction and again when cached matches are read.
- Admin/moderator accounts are excluded from candidate results.
- Mentor recommendations used by roadmaps and skill gaps now share those visibility boundaries.

## Known Limitations

Availability is a tag-overlap approximation rather than interval intersection in the match score; authoritative interval validation happens during booking. Weights are product hypotheses, not learned from conversion data. A future tuning process should use consented aggregate outcomes and preserve deterministic explanations.
