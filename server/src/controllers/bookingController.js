import AvailabilityRule from "../models/AvailabilityRule.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  cancelBooking, completeBooking, confirmBooking, createBooking, listBookings, markBookingNoShow, replaceAvailability, rescheduleBooking,
} from "../services/bookingService.js";
import { createNotification } from "../services/notificationService.js";

const otherParticipant = (booking, userId) => booking.teacher._id.toString() === userId.toString() ? booking.student : booking.teacher;
const notifyBooking = (booking, userId, event, title, body) => createNotification(otherParticipant(booking, userId)._id, {
  type: "booking", title, body, link: "/bookings", metadata: { bookingId: booking._id, status: booking.status }, dedupeKey: `booking:${booking._id}:${event}`,
});

export const create = asyncHandler(async (req, res) => {
  const booking = await createBooking(req.user._id, req.body);
  await createNotification(booking.confirmationRequiredBy, { type: "booking", title: "Booking confirmation requested", body: `${req.user.fullName || req.user.name} requested ${booking.skill.name}`, link: "/bookings", metadata: { bookingId: booking._id, status: booking.status }, dedupeKey: `booking:${booking._id}:created` });
  res.status(201).json({ success: true, data: booking, booking });
});
export const list = asyncHandler(async (req, res) => {
  const result = await listBookings(req.user._id, req.query);
  res.json({ success: true, ...result });
});
export const confirm = asyncHandler(async (req, res) => {
  const booking = await confirmBooking(req.user._id, req.params.id);
  await notifyBooking(booking, req.user._id, `confirmed:${booking.rescheduleHistory.length}`, "Booking confirmed", `${booking.skill.name} is confirmed`);
  res.json({ success: true, data: booking, booking, message: "Booking confirmed" });
});
export const reschedule = asyncHandler(async (req, res) => {
  const booking = await rescheduleBooking(req.user._id, req.params.id, req.body);
  await notifyBooking(booking, req.user._id, `rescheduled:${booking.rescheduleHistory.length}`, "New booking time requested", `${booking.skill.name} needs your confirmation`);
  res.json({ success: true, data: booking, booking, message: "Reschedule requested" });
});
export const cancel = asyncHandler(async (req, res) => {
  const booking = await cancelBooking(req.user._id, req.params.id, req.body.reason);
  await notifyBooking(booking, req.user._id, "cancelled", "Booking cancelled", `${booking.skill.name} was cancelled`);
  res.json({ success: true, data: booking, booking, message: "Booking cancelled" });
});
export const complete = asyncHandler(async (req, res) => {
  const booking = await completeBooking(req.user._id, req.params.id);
  await notifyBooking(booking, req.user._id, "completed", "Session completed", `You can now review your ${booking.skill.name} session`);
  res.json({ success: true, data: booking, booking, message: "Booking completed" });
});
export const noShow = asyncHandler(async (req, res) => {
  const booking = await markBookingNoShow(req.user._id, req.params.id, req.body.reason);
  await notifyBooking(booking, req.user._id, "no-show", "Session marked as a no-show", req.body.reason || "The other participant reported that the session was missed");
  res.json({ success: true, data: booking, booking, message: "No-show recorded" });
});
export const getAvailability = asyncHandler(async (req, res) => {
  const data = await AvailabilityRule.find({ user: req.user._id }).sort({ dayOfWeek: 1, startTime: 1 }).lean();
  res.json({ success: true, data, rules: data });
});
export const putAvailability = asyncHandler(async (req, res) => {
  const data = await replaceAvailability(req.user._id, req.body.rules);
  res.json({ success: true, data, rules: data, message: "Availability updated" });
});
