import { z } from "zod";
import { idParams, limit, page, requestSchema } from "./common.js";

const futureDate = z.coerce.date().refine((value) => value > new Date(), "Start time must be in the future");
const timezone = z.string().trim().min(1).max(100).refine((value) => {
  try { Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
}, "Invalid IANA timezone");
const duration = z.number().int().min(15).max(240).refine((value) => value % 15 === 0, "Use 15-minute increments");

export const createBookingSchema = requestSchema({
  body: z.object({
    proposalId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    leg: z.enum(["requested", "offered"]),
    sequence: z.number().int().min(1).max(100).default(1),
    startAt: futureDate,
    duration: duration.optional(),
    timezone,
    mode: z.enum(["video", "audio", "in_person"]).optional(),
    locationDetails: z.string().trim().max(500).default(""),
  }),
});
export const bookingIdSchema = requestSchema({ params: idParams() });
export const rescheduleBookingSchema = requestSchema({
  params: idParams(),
  body: z.object({
    startAt: futureDate,
    duration: duration.optional(),
    timezone,
    mode: z.enum(["video", "audio", "in_person"]).optional(),
    locationDetails: z.string().trim().max(500).optional(),
    reason: z.string().trim().max(500).default(""),
  }),
});
export const cancelBookingSchema = requestSchema({
  params: idParams(), body: z.object({ reason: z.string().trim().max(500).default("") }),
});
export const noShowBookingSchema = requestSchema({
  params: idParams(), body: z.object({ reason: z.string().trim().max(500).default("") }),
});
export const listBookingsSchema = requestSchema({
  query: z.object({
    view: z.enum(["all", "upcoming", "past"]).default("all"),
    status: z.enum(["requested", "confirmed", "upcoming", "in_progress", "completed", "cancelled", "no_show", "disputed"]).optional(),
    page, limit,
  }),
});
const availabilityRule = z.object({
  timezone,
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  modes: z.array(z.enum(["video", "audio", "in_person"])).max(3).default([]),
  isActive: z.boolean().default(true),
});
export const replaceAvailabilitySchema = requestSchema({ body: z.object({ rules: z.array(availabilityRule).max(50) }) });
