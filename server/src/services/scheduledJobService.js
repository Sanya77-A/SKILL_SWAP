import crypto from "crypto";
import ScheduledJob from "../models/ScheduledJob.js";

export async function runWithScheduledJobLock(name, work, { lockMs = 15 * 60 * 1000 } = {}) {
  const now = new Date();
  const lockId = crypto.randomUUID();
  let lock;
  try {
    lock = await ScheduledJob.findOneAndUpdate(
      { _id: name, $or: [{ lockedUntil: { $lte: now } }, { lockedUntil: null }] },
      {
        $set: { lockId, lockedUntil: new Date(now.getTime() + lockMs), lastStartedAt: now, lastErrorCode: "" },
        $setOnInsert: { _id: name },
      },
      { new: true, upsert: true }
    ).lean();
  } catch (error) {
    if (error?.code === 11000) return { started: false, status: "already_running" };
    throw error;
  }

  if (!lock || lock.lockId !== lockId) return { started: false, status: "already_running" };

  try {
    await work();
    await ScheduledJob.updateOne(
      { _id: name, lockId },
      { $set: { lockedUntil: new Date(0), lockId: "", lastCompletedAt: new Date(), lastErrorCode: "" } }
    );
    return { started: true, status: "completed" };
  } catch (error) {
    await ScheduledJob.updateOne(
      { _id: name, lockId },
      { $set: { lockedUntil: new Date(0), lockId: "", lastErrorCode: String(error?.code || error?.name || "JOB_FAILED").slice(0, 80) } }
    ).catch(() => {});
    throw error;
  }
}
