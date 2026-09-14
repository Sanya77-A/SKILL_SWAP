import Review from "../models/Review.js";
import Booking from "../models/Booking.js";
import Certificate from "../models/Certificate.js";
import GroupSession from "../models/GroupSession.js";
import Listing from "../models/Listing.js";
import Project from "../models/Project.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { ApiError } from "../utils/ApiError.js";
import { serializePublicUser } from "../serializers/userSerializer.js";
import { isBlockedBetween } from "./safetyService.js";

export function calculateSkillScore({ profileCompleteness = 0, ratingAvg = 0, sessionsCompleted = 0, verifiedSkills = 0 }) {
  const profile = Math.min(100, Math.max(0, profileCompleteness)) * 0.35;
  const reputation = Math.min(5, Math.max(0, ratingAvg)) * 20 * 0.35;
  const experience = Math.min(100, Math.log10(sessionsCompleted + 1) * 50) * 0.2;
  const verification = Math.min(100, verifiedSkills * 25) * 0.1;
  return Math.round(Math.min(100, profile + reputation + experience + verification));
}

export async function getProfessionalProfile({ username, id, viewerId }) {
  const identity = username ? { username: username.toLowerCase() } : { _id: id };
  const user = await User.findOne({
    ...identity,
    isDeleted: false,
    isBlocked: false,
    status: "active",
  });
  if (!user) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found");

  const isOwner = viewerId?.toString() === user._id.toString();
  if (!isOwner && viewerId && await isBlockedBetween(viewerId, user._id)) {
    throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found");
  }
  const visibility = user.profileVisibility || user.visibility;
  if (visibility === "private" && !isOwner) {
    throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found");
  }
  if (visibility === "members" && !viewerId) {
    throw new ApiError(401, "MEMBERS_ONLY_PROFILE", "Sign in to view this profile");
  }

  const reviewFilter = { $or: [{ reviewee: user._id }, { recipient: user._id }], moderationStatus: { $ne: "hidden" } };
  const [skills, reviews, reviewCount, legacyTaught, legacyLearned, bookingsTaught, bookingsLearned, groupSessionsTaught, projects, certificates, publishedListings] = await Promise.all([
    UserSkill.find({ user: user._id })
      .populate("skill", "name slug category icon status")
      .sort({ proficiency: -1, updatedAt: -1 })
      .lean(),
    Review.find(reviewFilter)
      .populate("reviewer", "name fullName username profileImage profilePhoto")
      .populate("author", "name fullName username profileImage profilePhoto")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Review.countDocuments(reviewFilter),
    Session.countDocuments({ status: "COMPLETED", teacherId: user._id }),
    Session.countDocuments({ status: "COMPLETED", studentId: user._id }),
    Booking.countDocuments({ status: "completed", teacher: user._id }),
    Booking.countDocuments({ status: "completed", student: user._id }),
    GroupSession.countDocuments({ status: "completed", mentor: user._id }),
    Project.find({ owner: user._id, status: "published" }).populate("skills", "name slug category icon status").sort({ featured: -1, completedAt: -1, updatedAt: -1 }).limit(12).lean(),
    Certificate.find({ learner: user._id, status: "active" }).select("certificateId learner skill mentor achievement sourceType evidenceSnapshot issuedAt status").populate("skill", "name slug category icon").populate("mentor", "name fullName username profilePhoto profileImage").sort({ issuedAt: -1 }).limit(12).lean(),
    Listing.countDocuments({ owner: user._id, status: "published" }),
  ]);
  const sessionsTaught = legacyTaught + bookingsTaught + groupSessionsTaught;
  const sessionsLearned = legacyLearned + bookingsLearned;
  const sessionsCompleted = sessionsTaught + sessionsLearned;

  const verifiedSkills = skills.filter((record) => record.verificationStatus === "verified").length;
  const skillScore = calculateSkillScore({
    profileCompleteness: user.profileCompleteness,
    ratingAvg: user.ratingAvg,
    sessionsCompleted,
    verifiedSkills,
  });

  if (user.sessionsCompleted !== sessionsCompleted || user.skillScore !== skillScore) {
    await User.updateOne({ _id: user._id }, { sessionsCompleted, skillScore });
  }

  return {
    user: serializePublicUser(user, { sessionsCompleted, skillScore, isOwner, viewerAuthenticated: Boolean(viewerId) }),
    skills,
    reviews,
    projects,
    certificates,
    stats: {
      ratingAvg: user.ratingAvg || 0,
      reviewCount,
      sessionsCompleted,
      responseTimeMinutes: user.responseTimeMinutes,
      skillScore,
      verifiedSkills,
      sessionsTaught,
      sessionsLearned,
      skillsLearned: skills.filter((record) => record.learningEnabled).length,
      projects: projects.length,
      certificates: certificates.length,
      mentorStatus: {
        isMentor: skills.some((record) => record.teachingEnabled) || ["mentor", "moderator", "admin", "super_admin"].includes(user.role),
        level: skills.some((record) => record.teachingEnabled && record.verificationStatus === "verified") ? "verified" : sessionsTaught > 0 || publishedListings > 0 ? "active" : skills.some((record) => record.teachingEnabled) ? "aspiring" : "not_mentor",
        teachingSkills: skills.filter((record) => record.teachingEnabled).length,
        publishedListings,
      },
    },
    isOwner,
  };
}
