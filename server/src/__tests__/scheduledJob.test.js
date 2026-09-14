import mongoose from "mongoose";
import ScheduledJob from "../models/ScheduledJob.js";
import { runWithScheduledJobLock } from "../services/scheduledJobService.js";
import { cronAuthorizationMatches } from "../controllers/jobController.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("scheduled jobs", () => {
  const jobName = `scheduled-job-${Date.now()}`;

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    await ScheduledJob.init();
  });

  afterAll(async () => {
    await ScheduledJob.deleteOne({ _id: jobName });
    await mongoose.disconnect();
  });

  test("requires the exact cron bearer secret", () => {
    expect(cronAuthorizationMatches("Bearer expected-secret", "expected-secret")).toBe(true);
    expect(cronAuthorizationMatches("Bearer wrong-secret", "expected-secret")).toBe(false);
    expect(cronAuthorizationMatches("", "expected-secret")).toBe(false);
  });

  test("prevents overlapping executions with a MongoDB lock", async () => {
    let executions = 0;
    let release;
    let signalStarted;
    const barrier = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const work = async () => {
      executions += 1;
      signalStarted();
      await barrier;
    };

    const first = runWithScheduledJobLock(jobName, work);
    await started;
    const second = await runWithScheduledJobLock(jobName, work);
    release();
    const firstResult = await first;

    expect(firstResult).toEqual({ started: true, status: "completed" });
    expect(second).toEqual({ started: false, status: "already_running" });
    expect(executions).toBe(1);
  });
});
