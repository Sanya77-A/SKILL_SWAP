import mongoose from "mongoose";

const bookingSlotSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    slotStart: { type: Date, required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    reservationToken: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

bookingSlotSchema.index({ user: 1, slotStart: 1 }, { unique: true });
bookingSlotSchema.index({ booking: 1 });

export default mongoose.model("BookingSlot", bookingSlotSchema);
