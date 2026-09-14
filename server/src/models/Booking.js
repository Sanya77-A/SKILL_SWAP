import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    previousStartAt: Date,
    previousEndAt: Date,
    previousTimezone: String,
    reason: { type: String, default: "", maxlength: 500 },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, required: true, unique: true, uppercase: true },
    proposal: { type: mongoose.Schema.Types.ObjectId, ref: "SwapProposal", required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", default: null },
    leg: { type: String, enum: ["requested", "offered"], required: true },
    sequence: { type: Number, min: 1, required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    skill: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    duration: { type: Number, min: 15, max: 240, required: true },
    timezone: { type: String, required: true, trim: true, maxlength: 100 },
    teacherTimezone: { type: String, required: true, trim: true, maxlength: 100 },
    studentTimezone: { type: String, required: true, trim: true, maxlength: 100 },
    mode: { type: String, enum: ["video", "audio", "in_person"], required: true },
    meetingUrl: { type: String, default: "", maxlength: 500 },
    locationDetails: { type: String, default: "", maxlength: 500 },
    status: {
      type: String,
      enum: ["requested", "confirmed", "upcoming", "in_progress", "completed", "cancelled", "no_show", "disputed"],
      default: "requested",
    },
    confirmationRequiredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    paymentModel: { type: String, enum: ["exchange", "credits", "paid", "hybrid"], default: "exchange" },
    creditAmount: { type: Number, min: 0, default: 0 },
    paymentAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, uppercase: true, default: "USD", minlength: 3, maxlength: 3 },
    rescheduleHistory: [historySchema],
    cancelReason: { type: String, default: "", maxlength: 500 },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    noShowReportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    noShowUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    noShowReason: { type: String, default: "", maxlength: 500 },
    noShowAt: { type: Date, default: null },
    reminder24hSentAt: { type: Date, default: null },
    reminder1hSentAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

bookingSchema.index({ proposal: 1, leg: 1, sequence: 1 }, { unique: true });
bookingSchema.index({ teacher: 1, status: 1, startAt: 1 });
bookingSchema.index({ student: 1, status: 1, startAt: 1 });
bookingSchema.index({ status: 1, startAt: 1 });

export default mongoose.model("Booking", bookingSchema);
