import {
  calculateAvailabilityMatch,
  calculateLanguageMatch,
  calculateMatchScore,
  calculateOverallMatch,
  calculatePriceMatch,
  calculateTimezoneMatch,
} from "../services/matchService.js";

describe("calculateMatchScore", () => {
  test("adds 50 points for mutual skill match", () => {
    const current = {
      skillsOffered: ["React"],
      skillsWanted: ["DSA"],
      availability: [],
      location: "",
      updatedAt: new Date(),
    };
    const target = {
      skillsOffered: ["DSA"],
      skillsWanted: ["React"],
      availability: [],
      location: "",
      updatedAt: new Date(),
    };
    const { matchScore, reasons } = calculateMatchScore(current, target);
    expect(matchScore).toBeGreaterThanOrEqual(50);
    expect(reasons).toContain("Mutual skill match");
  });

  test("adds points for high rating", () => {
    const current = { skillsOffered: [], skillsWanted: ["React"], availability: [], location: "", updatedAt: new Date() };
    const target = { skillsOffered: ["React"], skillsWanted: [], availability: [], location: "", ratingAvg: 4.5, updatedAt: new Date() };
    const { matchScore, reasons } = calculateMatchScore(current, target);
    expect(matchScore).toBeGreaterThanOrEqual(45);
    expect(reasons.some((r) => r.includes("rating") || r.includes("Rating"))).toBe(true);
  });

  test("adds 20 for availability overlap", () => {
    const current = { skillsOffered: [], skillsWanted: ["React"], availability: ["weekdays"], location: "", updatedAt: new Date() };
    const target = { skillsOffered: ["React"], skillsWanted: [], availability: ["weekdays"], location: "", updatedAt: new Date() };
    const { matchScore, reasons } = calculateMatchScore(current, target);
    expect(reasons).toContain("Availability overlap");
    expect(matchScore).toBeGreaterThanOrEqual(20);
  });

  test("normalizes every explainable factor and overall score to 0-100", () => {
    const current = {
      skillsOffered: ["React"], skillsWanted: ["Python"], availability: ["weekends"],
      location: "Pune", timezone: "Asia/Kolkata", languages: ["English"],
      learningGoals: ["Build Python APIs"], experienceLevel: "beginner",
      preferredLearningMode: "online", preferredExchangeModels: ["credits"], maxCreditCost: 60,
    };
    const target = {
      skillsOffered: ["Python"], skillsWanted: ["React"], availability: ["weekends"],
      location: "Pune", timezone: "Asia/Kolkata", languages: ["English"],
      headline: "Python API mentor", experienceLevel: "advanced", preferredTeachingMode: "online",
      ratingAvg: 4.8, ratingCount: 20, skillScore: 80,
    };
    const result = calculateOverallMatch(current, target, {
      targetListings: [{ creditsEnabled: true, creditCost: 50 }],
    });
    expect(result.matchScore).toBeGreaterThanOrEqual(75);
    expect(result.matchScore).toBeLessThanOrEqual(100);
    expect(Object.values(result.factors).every((factor) => factor.score >= 0 && factor.score <= 100)).toBe(true);
    expect(result.strengths).toContain("Mutual skill match");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test("reports deterministic timezone, language, availability, and price compatibility", () => {
    expect(calculateTimezoneMatch({ timezone: "UTC" }, { timezone: "UTC" })).toBe(100);
    expect(calculateLanguageMatch({ languages: ["English"] }, { languages: ["English"] })).toBe(100);
    expect(calculateAvailabilityMatch({ availability: ["weekends"] }, { availability: ["weekdays"] })).toBe(0);
    expect(calculatePriceMatch(
      { preferredExchangeModels: ["credits"], maxCreditCost: 40 },
      {},
      { targetListings: [{ creditsEnabled: true, creditCost: 80 }] }
    )).toBe(20);
  });
});
