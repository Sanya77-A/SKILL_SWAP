const intents = [
  "find_mentors", "suggest_skills", "recommend_swaps", "explain_match", "improve_profile",
  "prepare_session", "recommend_roadmap", "summarize_progress", "next_actions", "skill_gap_analysis",
];

const patterns = [
  ["find_mentors", /mentor|teacher|coach/i], ["explain_match", /match score|why.*match/i],
  ["improve_profile", /profile|bio|headline/i], ["prepare_session", /session|lesson|prepare/i],
  ["recommend_roadmap", /roadmap|learning plan/i], ["summarize_progress", /progress|summary|how am i doing/i],
  ["skill_gap_analysis", /skill gap|career goal|missing skill/i], ["recommend_swaps", /swap|exchange/i],
  ["suggest_skills", /skill|learn next/i],
];

export const supportedIntents = Object.freeze(intents);

export function routeIntent(input, explicitIntent) {
  if (explicitIntent) {
    if (!intents.includes(explicitIntent)) throw new Error(`Unsupported AI intent: ${explicitIntent}`);
    return explicitIntent;
  }
  return patterns.find(([, pattern]) => pattern.test(input))?.[0] || "next_actions";
}
