import crypto from "crypto";
import AIInteraction from "../models/AIInteraction.js";
import { aiService } from "./ai/aiService.js";
import { routeIntent } from "./ai/intentRouter.js";
import { loadAssistantContext } from "./assistantContextService.js";
import { logger } from "../utils/logger.js";

const mentorCard = (match) => ({ type: "mentor", id: match.user._id, title: match.user.fullName || match.user.name, subtitle: match.user.headline || "SkillSwap mentor", matchScore: match.matchScore, reasons: match.reasons, link: `/user/${match.user._id}` });
const skillCard = (skill) => ({ type: "skill", id: skill._id, title: skill.name, subtitle: skill.category, link: `/discover?skillId=${skill._id}` });
const bookingCard = (booking) => ({ type: "booking", id: booking._id, title: booking.skill?.name || "Session", subtitle: `${booking.status} · ${booking.duration} minutes`, startAt: booking.startAt, link: "/bookings" });
const listingCard = (listing) => ({ type: "listing", id: listing._id, title: listing.title, subtitle: `${listing.skill?.name || "Skill"} with ${listing.owner?.fullName || listing.owner?.name}`, link: `/listing/${listing._id}` });

function cardsFor(intent, context) {
  if (intent === "find_mentors") return context.matches.slice(0, 4).map(mentorCard);
  if (intent === "recommend_swaps") return context.matches.filter((match) => match.factors?.mutualSkill?.score > 0).slice(0, 4).map(mentorCard);
  if (intent === "suggest_skills" || intent === "recommend_roadmap" || intent === "skill_gap_analysis") return context.suggestedSkills.slice(0, 5).map(skillCard);
  if (intent === "explain_match") return (context.targetMatch ? [context.targetMatch] : context.matches.slice(0, 1)).map(mentorCard);
  if (intent === "prepare_session") return (context.targetBooking ? [context.targetBooking] : context.bookings.filter((booking) => ["requested", "confirmed", "upcoming"].includes(booking.status)).slice(0, 3)).map(bookingCard);
  if (intent === "improve_profile") return [{ type: "action", id: context.user._id, title: "Edit professional profile", subtitle: `${context.user.profileCompleteness || 0}% complete`, link: "/profile" }];
  if (intent === "next_actions") return [...context.listings.slice(0, 2).map(listingCard), ...context.bookings.filter((booking) => ["confirmed", "upcoming"].includes(booking.status)).slice(0, 2).map(bookingCard)];
  return [];
}

function groundedFallback(intent, context, cards) {
  const messages = {
    find_mentors: cards.length ? `I found ${cards.length} mentor${cards.length === 1 ? "" : "s"} ranked by your deterministic match factors.` : "I could not find an eligible mentor from the current marketplace records. Add a skill you want to learn to improve results.",
    suggest_skills: cards.length ? `These ${cards.length} catalog skills are not yet on your profile. Choose one that supports your learning goals.` : "Your current profile already covers the available skill suggestions.",
    recommend_swaps: cards.length ? `I found ${cards.length} mutual exchange candidate${cards.length === 1 ? "" : "s"} with reciprocal skill evidence.` : "No mutual skill exchange is currently supported by your match data. Add skills you can teach and want to learn.",
    explain_match: context.targetMatch ? `This match is ${context.targetMatch.matchScore}/100. Strong evidence: ${context.targetMatch.strengths.join(", ") || "limited"}. Conflicts: ${context.targetMatch.conflicts.join(", ") || "none identified"}.` : "Choose a mentor from your match results so I can explain the stored factor scores.",
    improve_profile: `Your profile is ${context.user.profileCompleteness || 0}% complete. Focus next on missing professional details, learning goals, canonical skills, and availability.`,
    prepare_session: cards.length ? "Use the linked real booking to confirm one outcome, two practice topics, and a clear question before the session." : "You have no eligible upcoming booking to prepare from yet.",
    recommend_roadmap: cards.length ? "Start with one suggested catalog skill, then define measurable milestones after choosing your target." : "Add a learning goal before building a grounded roadmap.",
    summarize_progress: `You have completed ${context.progress.completedSessions} learning sessions (${context.progress.hoursLearned} hours), with ${context.progress.upcomingSessions} upcoming sessions and ${context.progress.activeLearningSkills} active learning skills.`,
    next_actions: cards.length ? "Your highest-value next steps are tied to the real listings and sessions below." : "Complete your profile and add learning skills to unlock grounded next actions.",
    skill_gap_analysis: "Choose a career goal to compare your actual skill records with a required-skill framework.",
  };
  return messages[intent] || messages.next_actions;
}

export async function askAssistant(userId, payload) {
  const startedAt = Date.now();
  const intent = routeIntent(payload.message, payload.intent);
  const context = await loadAssistantContext(userId, payload);
  const cards = cardsFor(intent, context);
  let answer = groundedFallback(intent, context, cards);
  let provider = "grounded_fallback";
  let model = "";
  let responseId = "";
  let status = "grounded_fallback";
  let errorCode = "";
  if (aiService.provider !== "disabled") {
    try {
      const result = await aiService.generate({ userInput: payload.message, intent, context, maxOutputTokens: 700 });
      answer = result.data;
      provider = result.provider;
      model = result.model || "";
      responseId = result.responseId || "";
      status = "generated";
    } catch (error) {
      errorCode = error.code || "AI_PROVIDER_FAILURE";
      logger.warn("ai_generation_failed", { userId: userId.toString(), intent, provider: aiService.provider, errorCode });
    }
  }
  await AIInteraction.create({
    user: userId,
    requestHash: crypto.createHash("sha256").update(payload.message.trim()).digest("hex"),
    intent, provider, model, responseId, status, answer,
    cardReferences: cards.filter((card) => card.type !== "action").map((card) => ({ kind: card.type, id: card.id })),
    latencyMs: Date.now() - startedAt,
    errorCode,
  });
  return { answer, intent, cards, provider, grounded: status === "grounded_fallback", contextSummary: context.progress };
}
