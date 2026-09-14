import crypto from "crypto";
import AvailabilityRule from "../models/AvailabilityRule.js";
import Booking from "../models/Booking.js";
import BookingSlot from "../models/BookingSlot.js";
import Review from "../models/Review.js";
import SwapProposal from "../models/SwapProposal.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { refundBookingCredits, rewardTeachingCredits, spendBookingCredits } from "./creditService.js";
import { assertCanContact } from "./safetyService.js";

const activeStatuses = ["requested", "confirmed", "upcoming", "in_progress"];
const populate = [
  { path: "teacher", select: "name fullName username profileImage profilePhoto headline timezone" },
  { path: "student", select: "name fullName username profileImage profilePhoto headline timezone" },
  { path: "skill", select: "name slug category icon" },
  { path: "listing", select: "title slug" },
  { path: "proposal", select: "status offeredSessions requestedSessions" },
];

const slotStarts = (startAt, endAt) => {
  const values = [];
  for (let value = startAt.getTime(); value < endAt.getTime(); value += 15 * 60_000) values.push(new Date(value));
  return values;
};

async function reserveSlots(bookingId, participantIds, startAt, endAt, reservationToken = null, excludedKeys = new Set()) {
  const docs = participantIds.flatMap((user) => slotStarts(startAt, endAt).map((slotStart) => ({ user, slotStart, booking: bookingId, reservationToken })))
    .filter((doc) => !excludedKeys.has(`${doc.user}:${doc.slotStart.getTime()}`));
  if (!docs.length) return;
  try {
    await BookingSlot.insertMany(docs, { ordered: true });
  } catch (error) {
    await BookingSlot.deleteMany(reservationToken ? { booking: bookingId, reservationToken } : { booking: bookingId });
    if (error?.code === 11000) throw new ApiError(409, "BOOKING_CONFLICT", "One participant already has a booking in this time slot");
    throw error;
  }
}

const timeToMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const zonedParts = (date, timezone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return { dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")), minutes: Number(get("hour")) * 60 + Number(get("minute")) };
};

async function assertTeacherAvailability(teacherId, startAt, endAt, mode) {
  const rules = await AvailabilityRule.find({ user: teacherId, isActive: true }).lean();
  if (!rules.length) return;
  const valid = rules.some((rule) => {
    const start = zonedParts(startAt, rule.timezone);
    const end = zonedParts(endAt, rule.timezone);
    return start.dayOfWeek === rule.dayOfWeek && end.dayOfWeek === rule.dayOfWeek
      && start.minutes >= timeToMinutes(rule.startTime) && end.minutes <= timeToMinutes(rule.endTime)
      && (!rule.modes.length || rule.modes.includes(mode));
  });
  if (!valid) throw new ApiError(409, "OUTSIDE_AVAILABILITY", "The selected time is outside the teacher's availability");
}

const paymentModel = (proposal) => {
  const hasCredits = proposal.optionalCredits > 0;
  const hasPayment = proposal.optionalPayment?.amount > 0;
  if (hasCredits && hasPayment) return "hybrid";
  if (hasCredits) return "credits";
  if (hasPayment) return "paid";
  return "exchange";
};

export async function createBooking(actorId, payload) {
  const proposal = await SwapProposal.findOne({ _id: payload.proposalId, status: "accepted", $or: [{ requester: actorId }, { recipient: actorId }] });
  if (!proposal) throw new ApiError(404, "ACCEPTED_PROPOSAL_REQUIRED", "Accepted proposal not found");
  const maxSequence = payload.leg === "requested" ? proposal.requestedSessions : proposal.offeredSessions;
  if (payload.sequence > maxSequence) throw new ApiError(400, "INVALID_SEQUENCE", "Session sequence exceeds the accepted proposal terms");
  const teacher = payload.leg === "requested" ? proposal.recipient : proposal.requester;
  const student = payload.leg === "requested" ? proposal.requester : proposal.recipient;
  await assertCanContact(teacher, student);
  const skill = payload.leg === "requested" ? proposal.requestedSkill : proposal.offeredSkill;
  const [teacherUser, studentUser] = await Promise.all([
    User.findById(teacher).select("timezone").lean(), User.findById(student).select("timezone").lean(),
  ]);
  const startAt = new Date(payload.startAt);
  const duration = payload.duration || proposal.duration;
  const endAt = new Date(startAt.getTime() + duration * 60_000);
  const mode = payload.mode || proposal.deliveryMode;
  const creditAmount = payload.leg === "requested" ? proposal.optionalCredits || 0 : 0;
  const bookedPaymentAmount = payload.leg === "requested" ? proposal.optionalPayment?.amount || 0 : 0;
  if (bookedPaymentAmount > 0) throw new ApiError(409, "PAYMENT_REQUIRED", "Paid booking checkout is unavailable until an authoritative payment provider is configured");
  await assertTeacherAvailability(teacher, startAt, endAt, mode);

  const bookingId = new Booking()._id;
  await reserveSlots(bookingId, [teacher, student], startAt, endAt);
  let createdBooking;
  try {
    createdBooking = await Booking.create({
      _id: bookingId,
      bookingCode: `SS-${crypto.randomBytes(5).toString("hex")}`,
      proposal: proposal._id,
      listing: proposal.listing,
      leg: payload.leg,
      sequence: payload.sequence,
      teacher,
      student,
      skill,
      startAt,
      endAt,
      duration,
      timezone: payload.timezone,
      teacherTimezone: teacherUser?.timezone || "UTC",
      studentTimezone: studentUser?.timezone || "UTC",
      mode,
      locationDetails: payload.locationDetails || "",
      status: "requested",
      confirmationRequiredBy: actorId.toString() === teacher.toString() ? student : teacher,
      paymentModel: paymentModel({ optionalCredits: creditAmount, optionalPayment: { amount: bookedPaymentAmount } }),
      creditAmount,
      paymentAmount: bookedPaymentAmount,
      currency: proposal.optionalPayment?.currency || "USD",
    });
    await spendBookingCredits(createdBooking);
    await createdBooking.populate(populate);
    return createdBooking;
  } catch (error) {
    if (createdBooking) await refundBookingCredits(createdBooking).catch(() => {});
    await BookingSlot.deleteMany({ booking: bookingId });
    await Booking.deleteOne({ _id: bookingId });
    if (error?.code === 11000) throw new ApiError(409, "BOOKING_EXISTS", "This proposal session is already booked");
    throw error;
  }
}

async function ownedBooking(userId, bookingId) {
  const booking = await Booking.findOne({ _id: bookingId, $or: [{ teacher: userId }, { student: userId }] });
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found");
  return booking;
}

export async function confirmBooking(userId, bookingId) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: "requested", confirmationRequiredBy: userId, $or: [{ teacher: userId }, { student: userId }] },
    { $set: { status: "confirmed", confirmationRequiredBy: null } },
    { new: true }
  );
  if (!booking) throw new ApiError(403, "CONFIRMATION_NOT_ALLOWED", "This booking is not awaiting your confirmation");
  await booking.populate(populate);
  return booking;
}

export async function rescheduleBooking(userId, bookingId, payload) {
  const booking = await ownedBooking(userId, bookingId);
  if (!activeStatuses.includes(booking.status) || booking.status === "in_progress") throw new ApiError(409, "RESCHEDULE_NOT_ALLOWED", "This booking cannot be rescheduled");
  const startAt = new Date(payload.startAt);
  const duration = payload.duration || booking.duration;
  const endAt = new Date(startAt.getTime() + duration * 60_000);
  await assertTeacherAvailability(booking.teacher, startAt, endAt, payload.mode || booking.mode);

  const previous = { startAt: booking.startAt, endAt: booking.endAt };
  const operationToken = crypto.randomUUID();
  const participants = [booking.teacher, booking.student];
  const existingKeys = new Set(participants.flatMap((participant) => slotStarts(booking.startAt, booking.endAt).map((slotStart) => `${participant}:${slotStart.getTime()}`)));
  try {
    await reserveSlots(booking._id, participants, startAt, endAt, operationToken, existingKeys);
  } catch (error) {
    throw error;
  }
  const changes = {
    startAt, endAt, duration, timezone: payload.timezone,
    status: "requested",
    confirmationRequiredBy: userId.toString() === booking.teacher.toString() ? booking.student : booking.teacher,
    ...(payload.mode && { mode: payload.mode }),
    ...(payload.locationDetails !== undefined && { locationDetails: payload.locationDetails }),
  };
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, __v: booking.__v, status: booking.status },
    { $set: changes, $push: { rescheduleHistory: { changedBy: userId, previousStartAt: previous.startAt, previousEndAt: previous.endAt, previousTimezone: booking.timezone, reason: payload.reason || "" } }, $inc: { __v: 1 } },
    { new: true, runValidators: true }
  );
  if (!updated) {
    await BookingSlot.deleteMany({ booking: booking._id, reservationToken: operationToken });
    throw new ApiError(409, "BOOKING_STATE_CHANGED", "The booking changed while it was being rescheduled; refresh and try again");
  }
  const desiredStarts = slotStarts(startAt, endAt);
  await BookingSlot.deleteMany({ booking: booking._id, slotStart: { $nin: desiredStarts } });
  await BookingSlot.updateMany({ booking: booking._id, reservationToken: operationToken }, { $set: { reservationToken: null } });
  await updated.populate(populate);
  return updated;
}

export async function cancelBooking(userId, bookingId, reason) {
  let booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: activeStatuses }, $or: [{ teacher: userId }, { student: userId }] },
    { $set: { status: "cancelled", cancelReason: reason || "", cancelledBy: userId, confirmationRequiredBy: null } },
    { new: true }
  );
  if (!booking) {
    booking = await ownedBooking(userId, bookingId);
    if (booking.status !== "cancelled") throw new ApiError(409, "CANCEL_NOT_ALLOWED", "This booking cannot be cancelled");
  }
  await BookingSlot.deleteMany({ booking: booking._id });
  await refundBookingCredits(booking);
  await booking.populate(populate);
  return booking;
}

export async function completeBooking(userId, bookingId) {
  let booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: ["confirmed", "upcoming", "in_progress"] }, endAt: { $lte: new Date() }, $or: [{ teacher: userId }, { student: userId }] },
    { $set: { status: "completed", completedAt: new Date(), confirmationRequiredBy: null } },
    { new: true }
  );
  if (!booking) {
    booking = await ownedBooking(userId, bookingId);
    if (booking.status !== "completed") throw new ApiError(409, "COMPLETE_NOT_ALLOWED", "Booking can only be completed after its scheduled end");
  }
  await BookingSlot.deleteMany({ booking: booking._id });
  await rewardTeachingCredits(booking);
  await booking.populate(populate);
  return booking;
}

export async function markBookingNoShow(userId, bookingId, reason) {
  const original = await ownedBooking(userId, bookingId);
  const reporterIsTeacher = original.teacher.toString() === userId.toString();
  let booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: { $in: ["confirmed", "upcoming", "in_progress"] }, endAt: { $lte: new Date() }, $or: [{ teacher: userId }, { student: userId }] },
    { $set: { status: "no_show", noShowReportedBy: userId, noShowUser: reporterIsTeacher ? original.student : original.teacher, noShowReason: reason || "Participant did not attend the scheduled session", noShowAt: new Date(), confirmationRequiredBy: null } },
    { new: true }
  );
  if (!booking) {
    booking = await ownedBooking(userId, bookingId);
    if (booking.status !== "no_show") throw new ApiError(409, "NO_SHOW_NOT_ALLOWED", "A no-show can be reported only after a confirmed session ends");
  }
  await BookingSlot.deleteMany({ booking: booking._id });
  const persistedReporterIsTeacher = booking.teacher.toString() === booking.noShowReportedBy?.toString();
  if (persistedReporterIsTeacher) await rewardTeachingCredits(booking);
  else await refundBookingCredits(booking);
  await booking.populate(populate);
  return booking;
}

async function refreshTemporalStatuses(userId) {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const participant = { $or: [{ teacher: userId }, { student: userId }] };
  await Booking.updateMany({ ...participant, status: "confirmed", startAt: { $gt: now, $lte: soon } }, { status: "upcoming" });
  await Booking.updateMany({ ...participant, status: { $in: ["confirmed", "upcoming"] }, startAt: { $lte: now }, endAt: { $gt: now } }, { status: "in_progress" });
}

export async function listBookings(userId, { view, status, page, limit }) {
  await refreshTemporalStatuses(userId);
  const now = new Date();
  const filter = { $or: [{ teacher: userId }, { student: userId }] };
  if (status) filter.status = status;
  else if (view === "upcoming") filter.status = { $in: ["requested", "confirmed", "upcoming", "in_progress"] };
  else if (view === "past") {
    filter.status = { $in: ["completed", "cancelled", "no_show", "disputed"] };
  }
  if (view === "upcoming") filter.startAt = { $gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) };
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Booking.find(filter).populate(populate).sort({ startAt: view === "past" ? -1 : 1 }).skip(skip).limit(limit).lean(),
    Booking.countDocuments(filter),
  ]);
  const reviewedSessionIds = data.length
    ? await Review.distinct("session", { reviewer: userId, session: { $in: data.map((booking) => booking._id) } })
    : [];
  const reviewed = new Set(reviewedSessionIds.map(String));
  return { data: data.map((booking) => ({ ...booking, reviewedByMe: reviewed.has(booking._id.toString()) })), pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
}

export async function replaceAvailability(userId, rules) {
  for (let index = 0; index < rules.length; index += 1) {
    const current = rules[index];
    const start = timeToMinutes(current.startTime);
    const end = timeToMinutes(current.endTime);
    if (start >= end) throw new ApiError(400, "INVALID_AVAILABILITY", "Availability end time must be later than start time");
    const overlaps = rules.some((other, otherIndex) => otherIndex !== index && other.dayOfWeek === current.dayOfWeek && timeToMinutes(other.startTime) < end && timeToMinutes(other.endTime) > start);
    if (overlaps) throw new ApiError(400, "OVERLAPPING_AVAILABILITY", "Availability rules cannot overlap on the same day");
  }
  await AvailabilityRule.deleteMany({ user: userId });
  if (rules.length) await AvailabilityRule.insertMany(rules.map((rule) => ({ ...rule, user: userId })));
  return AvailabilityRule.find({ user: userId }).sort({ dayOfWeek: 1, startTime: 1 }).lean();
}
