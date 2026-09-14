import Booking from "../models/Booking.js";
import { createNotification } from "./notificationService.js";

async function notifyParticipants(booking, windowLabel) {
  const title = `Session starts ${windowLabel}`;
  await Promise.all([booking.teacher, booking.student].map((userId) => createNotification(userId, {
    type: "booking_reminder",
    title,
    body: `${booking.skill?.name || "Your session"} starts at ${booking.startAt.toISOString()}`,
    link: "/bookings",
    priority: windowLabel === "within an hour" ? "high" : "normal",
    metadata: { bookingId: booking._id, startAt: booking.startAt },
    dedupeKey: `booking:${booking._id}:reminder:${windowLabel}:${userId}`,
  })));
}

export async function processBookingReminders(now = new Date()) {
  const oneHour = new Date(now.getTime() + 60 * 60_000);
  const oneDay = new Date(now.getTime() + 24 * 60 * 60_000);
  const active = { status: { $in: ["confirmed", "upcoming"] }, startAt: { $gt: now } };
  const [hourBookings, dayBookings] = await Promise.all([
    Booking.find({ ...active, startAt: { $gt: now, $lte: oneHour }, reminder1hSentAt: null }).populate("skill", "name"),
    Booking.find({ ...active, startAt: { $gt: oneHour, $lte: oneDay }, reminder24hSentAt: null }).populate("skill", "name"),
  ]);
  for (const booking of hourBookings) {
    await notifyParticipants(booking, "within an hour");
    booking.reminder1hSentAt = now;
    await booking.save();
  }
  for (const booking of dayBookings) {
    await notifyParticipants(booking, "within 24 hours");
    booking.reminder24hSentAt = now;
    await booking.save();
  }
  return { oneHour: hourBookings.length, oneDay: dayBookings.length };
}
