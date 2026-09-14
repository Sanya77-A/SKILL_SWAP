# SkillSwap AI Evaluation

Date: 2026-08-23

## Evaluation Approach

The review evaluates grounding, intent routing, privacy, structured output, provider normalization, failure handling, and deterministic fallback. It does not treat “text returned” as success.

## Cases

Representative contexts cover a beginner developer, experienced designer, career switcher, musician, student, mentor, incomplete profile, and conflicting goals across mentor/skill recommendations, profile improvement, roadmaps, skill gaps, match explanations, progress summaries, and next actions.

## Grounding Checks

Provider prompts identify database context as authoritative, prohibit invented users/listings/bookings/scores/credentials/certificates/balances/activity, and instruct the provider to ignore instructions embedded in context. Context construction allowlists fields and excludes email. Mentor and skill cards are resolved from canonical database records. Match scores, balances, roadmap progress, eligibility, and certificates remain deterministic server state.

## Structured Output

Provider-neutral JSON parsing rejects malformed JSON with `AI_INVALID_JSON`. Roadmap output additionally crosses a bounded Zod schema (2-8 milestones, 1-8 tasks each) and falls back to a deterministic blueprint when malformed. Provider output cannot supply users, dates, scores, or progress.

## Provider Reliability

OpenAI Responses, Gemini, and Groq adapters normalize different result shapes. The HTTP client has abort-based timeouts, bounded exponential retry for 408/409/429/5xx, and normalized errors for invalid keys, rate limits, quota/provider failures, empty/invalid data, network errors, and timeouts. AI-specific HTTP status values now reach central error handling. Core assistant/roadmap/skill-gap flows retain grounded fallbacks; AI is disabled by default.

## Issues Fixed

- Central error handling now recognizes normalized AI `status` values.
- Provider failures remain internal in production while deterministic functionality stays available.

## Known Limitations

There is no semantic LLM judge or production prompt telemetry. Quality is evaluated by deterministic contracts and representative fixtures. Provider phrasing can still vary; generated prose is advisory and must never be treated as evidence.
