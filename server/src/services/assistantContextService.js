import Booking from "../models/Booking.js";
import Listing from "../models/Listing.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { getMatches } from "./matchService.js";

const userFields = "name fullName username headline bio location timezone languages learningGoals experienceLevel ratingAvg ratingCount sessionsCompleted profileCompleteness preferredLearningModes preferredTeachingModes preferredExchangeModels maxCreditCost maxSessionPrice";

export async function loadAssistantContext(userId, { targetUserId, bookingId } = {}) {
  const [user, skills, matchResult, bookings] = await Promise.all([
    User.findById(userId).select(userFields).lean(),
    UserSkill.find({ user: userId }).populate("skill", "name slug category description tags status").lean(),
    getMatches(userId, { page: 1, limit: 10 }),
    Booking.find({ $or: [{ teacher: userId }, { student: userId }] })
      .populate("skill", "name slug category")
      .populate("teacher", "name fullName username profilePhoto")
      .populate("student", "name fullName username profilePhoto")
      .sort({ startAt: -1 }).limit(30).lean(),
  ]);
  const matches = matchResult.data;
  const mentorIds = matches.map((match) => match.user._id);
  const [listings, suggestedSkills] = await Promise.all([
    Listing.find({ owner: { $in: mentorIds }, status: "published" }).populate("skill", "name slug category").populate("owner", "name fullName username profilePhoto ratingAvg").sort({ ratingAvg: -1 }).limit(20).lean(),
    Skill.find({ status: "active", _id: { $nin: skills.map((record) => record.skill?._id).filter(Boolean) } }).sort({ popularity: -1, name: 1 }).limit(12).lean(),
  ]);
  const completedLearning = bookings.filter((booking) => booking.status === "completed" && booking.student?._id?.toString() === userId.toString());
  const progress = {
    completedSessions: completedLearning.length,
    hoursLearned: Math.round(completedLearning.reduce((sum, booking) => sum + booking.duration, 0) / 6) / 10,
    activeLearningSkills: skills.filter((record) => record.learningEnabled).length,
    upcomingSessions: bookings.filter((booking) => ["requested", "confirmed", "upcoming", "in_progress"].includes(booking.status)).length,
  };
  return {
    user, skills, matches, listings, bookings, suggestedSkills, progress,
    targetMatch: targetUserId ? matches.find((match) => match.user._id.toString() === targetUserId.toString()) : null,
    targetBooking: bookingId ? bookings.find((booking) => booking._id.toString() === bookingId.toString()) : null,
  };
}
