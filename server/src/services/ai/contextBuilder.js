const cap = (items, max) => Array.isArray(items) ? items.slice(0, max) : [];
const text = (value, max = 300) => typeof value === "string" ? value.slice(0, max) : value;

export function buildAIContext(source = {}) {
  const user = source.user || {};
  return {
    user: {
      id: user._id?.toString?.() || user.id,
      name: text(user.fullName || user.name, 100), headline: text(user.headline, 160), bio: text(user.bio, 600),
      location: text(user.location, 150), timezone: text(user.timezone, 80), languages: cap(user.languages, 10),
      learningGoals: cap(user.learningGoals, 10).map((value) => text(value)), experienceLevel: user.experienceLevel,
      ratingAvg: user.ratingAvg, sessionsCompleted: user.sessionsCompleted, profileCompleteness: user.profileCompleteness,
    },
    skills: cap(source.skills, 40).map((item) => ({ id: (item.skill?._id || item._id)?.toString?.(), name: text(item.skill?.name || item.name, 120), type: item.type, proficiency: item.proficiency, yearsExperience: item.yearsExperience, verificationStatus: item.verificationStatus })),
    catalogSkills: cap(source.suggestedSkills, 20).map((item) => ({ id: item._id?.toString?.(), name: text(item.name, 120), category: text(item.category, 120), description: text(item.description, 400), tags: cap(item.tags, 10) })),
    listings: cap(source.listings, 20).map((item) => ({ id: item._id?.toString?.(), title: text(item.title, 160), skill: text(item.skill?.name, 120), deliveryMode: item.deliveryMode, exchangeEnabled: item.exchangeEnabled, creditsEnabled: item.creditsEnabled, creditCost: item.creditCost, price: item.price, currency: item.currency })),
    matches: cap(source.matches, 15).map((item) => ({ userId: (item.user?._id || item.matchedUser?._id)?.toString?.(), name: text(item.user?.name || item.matchedUser?.name, 100), score: item.matchScore, strengths: cap(item.strengths, 6), conflicts: cap(item.conflicts, 6), reasons: cap(item.reasons, 6) })),
    bookings: cap(source.bookings, 20).map((item) => ({ id: item._id?.toString?.(), skill: text(item.skill?.name, 120), startAt: item.startAt, status: item.status, mode: item.mode, duration: item.duration })),
    roadmaps: cap(source.roadmaps, 10),
    skillGap: source.skillGap ? {
      careerGoal: text(source.skillGap.careerGoal, 120),
      missingSkills: cap(source.skillGap.missingSkills, 30).map((item) => ({ name: text(item.name, 120), requiredProficiency: item.requiredProficiency, importance: item.importance, priority: item.priority })),
      weakSkills: cap(source.skillGap.weakSkills, 30).map((item) => ({ name: text(item.name, 120), currentProficiency: item.currentProficiency, requiredProficiency: item.requiredProficiency, importance: item.importance, priority: item.priority })),
      recommendedNextSkills: cap(source.skillGap.recommendedNextSkills, 30).map((item) => ({ name: text(item.name, 120), currentProficiency: item.currentProficiency, requiredProficiency: item.requiredProficiency, importance: item.importance, priority: item.priority })),
    } : null,
    progress: source.progress || null,
  };
}
