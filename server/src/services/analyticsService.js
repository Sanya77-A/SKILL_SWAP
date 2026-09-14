import crypto from "crypto";
import { env } from "../config/env.js";
import AnalyticsEvent from "../models/AnalyticsEvent.js";
import Booking from "../models/Booking.js";
import CreditTransaction from "../models/CreditTransaction.js";
import GroupSession from "../models/GroupSession.js";
import GroupSessionEnrollment from "../models/GroupSessionEnrollment.js";
import Review from "../models/Review.js";
import Session from "../models/Session.js";
import Skill from "../models/Skill.js";
import SwapProposal from "../models/SwapProposal.js";

const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
const percent = (part, total) => total ? Math.round((part / total) * 1000) / 10 : 0;

export async function recordAnalyticsView({ subject, actor, type, entityId, request }) {
  if (!subject || actor?.toString() === subject.toString()) return null;
  const activityDay = dayKey();
  const visitor = actor?.toString() || `${request.ip || "unknown"}|${request.get("user-agent") || "unknown"}`;
  const secret = env.ANALYTICS_SALT;
  const eventKey = crypto.createHash("sha256").update(`${secret}|${visitor}|${type}|${entityId}|${activityDay}`).digest("hex");
  try { return await AnalyticsEvent.create({ subject, actor: actor || null, type, entityType: type === "profile_view" ? "profile" : "listing", entityId, activityDay, eventKey }); }
  catch (error) { if (error?.code === 11000) return AnalyticsEvent.findOne({ eventKey }); throw error; }
}

export async function getMentorAnalytics(userId, rangeDays = 30) {
  const since = rangeDays === "all" ? null : new Date(Date.now() - Number(rangeDays) * 86400000);
  const dated = (field = "createdAt") => since ? { [field]: { $gte: since } } : {};
  const bookingFilter = { teacher: userId, ...dated() };
  const groupFilter = { mentor: userId, ...dated() };
  const [views, bookings, groups, legacyTaught, reviews, incomingProposals, creditRows] = await Promise.all([
    AnalyticsEvent.find({ subject: userId, ...dated("occurredAt") }).select("type activityDay").lean(),
    Booking.find(bookingFilter).select("student skill status paymentAmount currency createdAt completedAt").lean(),
    GroupSession.find(groupFilter).select("skill status price currency createdAt").lean(),
    Session.countDocuments({ teacherId: userId, status: "COMPLETED", ...dated("updatedAt") }),
    Review.find({ $or: [{ reviewee: userId }, { recipient: userId }], moderationStatus: { $ne: "hidden" }, ...dated() }).select("reviewer ratings rating wouldLearnAgain").lean(),
    SwapProposal.find({ recipient: userId, status: { $ne: "draft" }, ...dated() }).select("status respondedAt createdAt").lean(),
    CreditTransaction.find({ user: userId, type: "teaching_reward", amount: { $gt: 0 }, ...dated() }).select("amount createdAt").lean(),
  ]);
  const groupIds = groups.map((item) => item._id);
  const attended = groupIds.length ? await GroupSessionEnrollment.find({ groupSession: { $in: groupIds }, status: "attended" }).select("groupSession participant").lean() : [];
  const completedBookings = bookings.filter((item) => item.status === "completed");
  const completedGroups = groups.filter((item) => item.status === "completed");
  const cancelledBookings = bookings.filter((item) => item.status === "cancelled");
  const responded = incomingProposals.filter((item) => item.respondedAt);
  const responseMinutes = responded.map((item) => (new Date(item.respondedAt) - new Date(item.createdAt)) / 60000).filter((value) => value >= 0);
  const learnerCounts = new Map();
  for (const booking of completedBookings) learnerCounts.set(booking.student.toString(), (learnerCounts.get(booking.student.toString()) || 0) + 1);
  for (const enrollment of attended) learnerCounts.set(enrollment.participant.toString(), (learnerCounts.get(enrollment.participant.toString()) || 0) + 1);
  const skillCounts = new Map();
  for (const booking of completedBookings) skillCounts.set(booking.skill.toString(), (skillCounts.get(booking.skill.toString()) || 0) + 1);
  for (const session of completedGroups) skillCounts.set(session.skill.toString(), (skillCounts.get(session.skill.toString()) || 0) + 1);
  const skills = await Skill.find({ _id: { $in: [...skillCounts.keys()] } }).select("name slug category icon").lean();
  const bookedCurrency = new Map();
  for (const booking of completedBookings.filter((item) => item.paymentAmount > 0)) bookedCurrency.set(booking.currency, (bookedCurrency.get(booking.currency) || 0) + booking.paymentAmount);
  const ratings = reviews.map((item) => item.ratings?.overall || item.rating).filter(Number.isFinite);
  const byDay = new Map();
  for (const event of views) {
    const value = byDay.get(event.activityDay) || { date: event.activityDay, profileViews: 0, listingViews: 0 };
    if (event.type === "profile_view") value.profileViews += 1; else value.listingViews += 1;
    byDay.set(event.activityDay, value);
  }
  return {
    rangeDays,
    profileViews: views.filter((item) => item.type === "profile_view").length,
    listingViews: views.filter((item) => item.type === "listing_view").length,
    bookingRequests: bookings.length,
    conversionRate: percent(completedBookings.length, bookings.length),
    sessionsTaught: completedBookings.length + completedGroups.length + legacyTaught,
    averageRating: ratings.length ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 100) / 100 : 0,
    ratingCount: ratings.length,
    repeatLearners: [...learnerCounts.values()].filter((count) => count > 1).length,
    uniqueLearners: learnerCounts.size,
    skillCreditsEarned: creditRows.reduce((sum, item) => sum + item.amount, 0),
    revenue: { settledTotal: 0, currencies: [...bookedCurrency].map(([currency, bookedAmount]) => ({ currency, bookedAmount })), settlementAvailable: false, basis: "completed_booking_terms_until_payment_ledger" },
    responseRate: percent(responded.length, incomingProposals.length),
    averageResponseMinutes: responseMinutes.length ? Math.round(responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length) : null,
    cancellationRate: percent(cancelledBookings.length, bookings.length),
    topSkills: skills.map((skill) => ({ ...skill, sessions: skillCounts.get(skill._id.toString()) || 0 })).sort((left, right) => right.sessions - left.sessions || left.name.localeCompare(right.name)).slice(0, 8),
    timeSeries: [...byDay.values()].sort((left, right) => left.date.localeCompare(right.date)),
    definitions: {
      conversionRate: "completed one-to-one bookings / all one-to-one booking requests",
      responseRate: "incoming submitted proposals with a recorded response / all incoming submitted proposals",
      cancellationRate: "cancelled one-to-one bookings / all one-to-one booking requests",
      repeatLearners: "distinct learners with more than one completed one-to-one or attended group session",
      views: "unique viewer/entity/UTC-day events; self-views excluded",
    },
    calculatedAt: new Date(),
  };
}
