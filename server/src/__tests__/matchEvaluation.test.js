import { calculateOverallMatch } from "../services/matchService.js";

const learner = {
  skillsOffered: ["React"], skillsWanted: ["Python"], availability: ["saturday-evening"],
  timezone: "Asia/Kolkata", location: "Pune", languages: ["English", "Hindi"],
  learningGoals: ["Build Python APIs"], experienceLevel: "beginner",
  preferredLearningModes: ["online"], preferredExchangeModels: ["exchange", "credits"], maxCreditCost: 50,
};
const mentor = {
  skillsOffered: ["Python"], skillsWanted: ["React"], availability: ["saturday-evening"],
  timezone: "Asia/Kolkata", location: "Pune", languages: ["English"], headline: "Python API mentor",
  experienceLevel: "advanced", preferredTeachingModes: ["online"], ratingAvg: 4.7, ratingCount: 18, skillScore: 82,
};
const listing = { exchangeEnabled: true, creditsEnabled: true, paidEnabled: false, creditCost: 40 };

const cases = [
  ["perfect reciprocal swap", {}, [listing]], ["one-way skill fit", { skillsWanted: [] }, [listing]],
  ["incompatible schedule", { availability: ["weekday-morning"] }, [listing]], ["missing schedule", { availability: [] }, [listing]],
  ["shared language", {}, [listing]], ["language mismatch", { languages: ["Spanish"] }, [listing]],
  ["remote compatible", {}, [listing]], ["mode mismatch", { preferredTeachingModes: ["in-person"] }, [listing]],
  ["same location", {}, [listing]], ["different location", { location: "Delhi" }, [listing]],
  ["unknown location", { location: "" }, [listing]], ["same timezone", {}, [listing]],
  ["near timezone", { timezone: "Asia/Dubai" }, [listing]], ["far timezone", { timezone: "America/Los_Angeles" }, [listing]],
  ["unknown timezone", { timezone: "" }, [listing]], ["experienced mentor", {}, [listing]],
  ["underqualified mentor", { experienceLevel: "beginner" }, [listing]], ["high reputation weak skill", { skillsOffered: ["Guitar"], ratingAvg: 5, ratingCount: 100 }, [listing]],
  ["skill fit sparse reputation", { ratingAvg: 0, ratingCount: 0, skillScore: 0 }, [listing]], ["goal aligned", {}, [listing]],
  ["goal mismatch", { headline: "Classical music teacher", skillsOffered: ["Python"] }, [listing]], ["credit compatible", {}, [{ ...listing, exchangeEnabled: false }]],
  ["credit too expensive", {}, [{ ...listing, exchangeEnabled: false, creditCost: 90 }]], ["exchange compatible", {}, [{ ...listing, creditsEnabled: false }]],
  ["unsupported paid only", {}, [{ exchangeEnabled: false, creditsEnabled: false, paidEnabled: true, price: 100 }]],
  ["missing listing terms", {}, []], ["missing optional profile", { location: "", timezone: "", languages: [], availability: [], preferredTeachingModes: [] }, []],
  ["excellent skills poor availability", { availability: ["weekday-morning"] }, [listing]], ["weak skills excellent availability", { skillsOffered: ["Guitar"] }, [listing]],
  ["mentor-only candidate", { skillsWanted: [], role: "mentor" }, [listing]],
].map(([name, changes, targetListings]) => ({ name, target: { ...mentor, ...changes }, context: { targetListings } }));

const score = (name) => {
  const item = cases.find((entry) => entry.name === name);
  return calculateOverallMatch(learner, item.target, item.context).matchScore;
};

describe("deterministic match quality evaluation", () => {
  test("evaluates 30 representative profiles with bounded, factor-derived output", () => {
    expect(cases).toHaveLength(30);
    for (const item of cases) {
      const result = calculateOverallMatch(learner, item.target, item.context);
      expect(result.matchScore).toBeGreaterThanOrEqual(0);
      expect(result.matchScore).toBeLessThanOrEqual(100);
      expect(result.reasons.every((reason) => Object.values(result.factors).some((factor) => factor.detail === reason && factor.score >= 60))).toBe(true);
    }
  });

  test("ranks core compatibility above weaker secondary signals", () => {
    expect(score("perfect reciprocal swap")).toBeGreaterThan(score("excellent skills poor availability"));
    expect(score("excellent skills poor availability")).toBeGreaterThan(score("high reputation weak skill"));
    expect(score("skill fit sparse reputation")).toBeGreaterThan(score("high reputation weak skill"));
  });

  test("orders schedule, language, experience, and exchange-term compatibility", () => {
    expect(score("perfect reciprocal swap")).toBeGreaterThan(score("incompatible schedule"));
    expect(score("shared language")).toBeGreaterThan(score("language mismatch"));
    const advancedLearner = { ...learner, experienceLevel: "advanced" };
    expect(calculateOverallMatch(advancedLearner, mentor, { targetListings: [listing] }).matchScore)
      .toBeGreaterThan(calculateOverallMatch(advancedLearner, { ...mentor, experienceLevel: "beginner" }, { targetListings: [listing] }).matchScore);
    expect(score("credit compatible")).toBeGreaterThan(score("credit too expensive"));
    expect(score("exchange compatible")).toBeGreaterThan(score("unsupported paid only"));
  });
});
