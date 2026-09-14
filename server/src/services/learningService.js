import Booking from "../models/Booking.js";
import Certificate from "../models/Certificate.js";
import ChallengeDayCompletion from "../models/ChallengeDayCompletion.js";
import Roadmap from "../models/Roadmap.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const dayKey = (value) => new Date(value).toISOString().slice(0, 10);
const shiftUtcDay = (key, days) => {
  const value = new Date(`${key}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return dayKey(value);
};

export function calculateLearningStreak(values, now = new Date()) {
  const days = [...new Set(values.filter(Boolean).map(dayKey))].sort().reverse();
  if (!days.length) return { current: 0, longest: 0, lastActivityDate: null, activityDays: [] };
  const today = dayKey(now);
  const yesterday = shiftUtcDay(today, -1);
  let current = 0;
  if ([today, yesterday].includes(days[0])) {
    let expected = days[0];
    for (const day of days) {
      if (day !== expected) break;
      current += 1;
      expected = shiftUtcDay(expected, -1);
    }
  }
  const ascending = [...days].sort();
  let longest = 1;
  let run = 1;
  for (let index = 1; index < ascending.length; index += 1) {
    if (ascending[index] === shiftUtcDay(ascending[index - 1], 1)) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
  }
  return { current, longest, lastActivityDate: days[0], activityDays: days.slice(0, 90) };
}

const milestoneView = (roadmap, milestone) => ({
  roadmapId: roadmap._id,
  roadmapGoal: roadmap.goal,
  targetSkill: roadmap.targetSkill,
  milestoneId: milestone._id,
  title: milestone.title,
  description: milestone.description,
  order: milestone.order,
  targetDate: milestone.targetDate,
  status: milestone.status,
  completedAt: milestone.completedAt,
});

export async function getMyLearning(userId) {
  const [user, activeSkills, roadmaps, bookings, legacySessions, certificates, challengeDays] = await Promise.all([
    User.findById(userId).select("learningGoals timezone").lean(),
    UserSkill.find({ user: userId, learningEnabled: true }).populate("skill", "name slug category description icon status").sort({ updatedAt: -1 }).lean(),
    Roadmap.find({ user: userId, status: { $ne: "archived" } }).populate("targetSkill", "name slug category icon status").sort({ updatedAt: -1 }).lean(),
    Booking.find({ student: userId }).populate("skill", "name slug category").populate("teacher", "name fullName username profilePhoto profileImage headline").sort({ startAt: -1 }).lean(),
    Session.find({ studentId: userId }).populate("teacherId", "name fullName username profilePhoto profileImage").sort({ updatedAt: -1 }).limit(50).lean(),
    Certificate.find({ learner: userId, status: "active" }).populate("skill", "name slug category icon").populate("mentor", "name fullName username profilePhoto profileImage").sort({ issuedAt: -1 }).lean(),
    ChallengeDayCompletion.find({ user: userId }).select("completedAt").sort({ completedAt: -1 }).limit(365).lean(),
  ]);

  const completedBookings = bookings.filter((booking) => booking.status === "completed");
  const upcomingBookings = bookings.filter((booking) => ["requested", "confirmed", "upcoming", "in_progress"].includes(booking.status));
  const completedMilestones = roadmaps.flatMap((roadmap) => roadmap.milestones.filter((item) => item.status === "completed").map((item) => milestoneView(roadmap, item)));
  const pendingMilestones = roadmaps.flatMap((roadmap) => roadmap.milestones.filter((item) => item.status !== "completed").map((item) => milestoneView(roadmap, item)))
    .sort((left, right) => new Date(left.targetDate || "9999-12-31") - new Date(right.targetDate || "9999-12-31"));
  const activityDates = [
    ...completedBookings.map((booking) => booking.completedAt || booking.endAt),
    ...roadmaps.flatMap((roadmap) => roadmap.milestones.map((item) => item.completedAt)),
    ...roadmaps.flatMap((roadmap) => roadmap.tasks.map((item) => item.completedAt)),
    ...challengeDays.map((item) => item.completedAt),
  ];
  const profileGoals = user?.learningGoals || [];
  const goals = [
    ...profileGoals.map((goal) => ({ id: `profile:${goal}`, goal, source: "profile", status: "active" })),
    ...roadmaps.map((roadmap) => ({ id: roadmap._id, goal: roadmap.goal, source: "roadmap", status: roadmap.status, progress: roadmap.progress, targetSkill: roadmap.targetSkill, targetDate: roadmap.targetDate })),
  ];

  return {
    activeSkills: activeSkills.filter((item) => item.skill?.status === "active"),
    roadmaps,
    sessions: {
      upcoming: upcomingBookings.sort((left, right) => new Date(left.startAt) - new Date(right.startAt)),
      completed: completedBookings,
      legacy: legacySessions,
      total: bookings.length + legacySessions.length,
    },
    hoursLearned: Math.round(completedBookings.reduce((sum, booking) => sum + booking.duration, 0) / 6) / 10,
    milestones: { completed: completedMilestones, upcoming: pendingMilestones, total: completedMilestones.length + pendingMilestones.length },
    streak: calculateLearningStreak(activityDates),
    certificates,
    goals,
    summary: {
      activeSkills: activeSkills.filter((item) => item.skill?.status === "active").length,
      activeRoadmaps: roadmaps.filter((roadmap) => ["draft", "active", "paused"].includes(roadmap.status)).length,
      completedSessions: completedBookings.length,
      upcomingSessions: upcomingBookings.length,
      completedMilestones: completedMilestones.length,
      certificates: certificates.length,
    },
    calculatedAt: new Date(),
  };
}
