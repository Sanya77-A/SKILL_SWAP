import { Router } from "express";
import * as booking from "../controllers/bookingController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  bookingIdSchema, cancelBookingSchema, createBookingSchema, listBookingsSchema, noShowBookingSchema, replaceAvailabilitySchema, rescheduleBookingSchema,
} from "../validators/booking.js";

const router = Router();
router.use(protect);
router.get("/", validate(listBookingsSchema), booking.list);
router.post("/", validate(createBookingSchema), booking.create);
router.post("/:id/confirm", validate(bookingIdSchema), booking.confirm);
router.post("/:id/reschedule", validate(rescheduleBookingSchema), booking.reschedule);
router.post("/:id/cancel", validate(cancelBookingSchema), booking.cancel);
router.post("/:id/complete", validate(bookingIdSchema), booking.complete);
router.post("/:id/no-show", validate(noShowBookingSchema), booking.noShow);
router.get("/availability/me", booking.getAvailability);
router.put("/availability/me", validate(replaceAvailabilitySchema), booking.putAvailability);
export default router;
