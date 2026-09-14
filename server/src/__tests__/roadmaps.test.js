import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Roadmap from "../models/Roadmap.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Editable learning roadmaps", () => {
  const marker = `${Date.now()}`;
  let learnerCookie;
  let outsiderCookie;
  let learner;
  let mentor;
  let skill;
  let roadmap;

  const register = async (label) => request(app).post("/api/auth/register").send({
    name: `${label} Roadmap`, email: `test-roadmap-${label.toLowerCase()}-${marker}@test.com`, password: "password123",
  }).expect(201);

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    const [learnerAuth, mentorAuth, outsiderAuth] = await Promise.all([register("Learner"), register("Mentor"), register("Outsider")]);
    learnerCookie = learnerAuth.headers["set-cookie"];
    outsiderCookie = outsiderAuth.headers["set-cookie"];
    learner = await User.findById(learnerAuth.body.user._id);
    mentor = await User.findByIdAndUpdate(mentorAuth.body.user._id, { headline: "Roadmap mentor", ratingAvg: 4.6, ratingCount: 10 }, { new: true });
    skill = await Skill.create({ name: `Distributed Systems ${marker}`, slug: `distributed-systems-${marker}`, category: "Technology" });
    await UserSkill.create({ user: mentor._id, skill: skill._id, type: "teach", proficiency: "Expert", yearsExperience: 9, verificationStatus: "verified" });
  });

  afterAll(async () => {
    const users = await User.find({ email: new RegExp(`^test-roadmap-.*-${marker}@test\\.com$`) }).select("_id");
    const userIds = users.map((user) => user._id);
    await Promise.all([
      Roadmap.deleteMany({ user: { $in: userIds } }),
      UserSkill.deleteMany({ user: { $in: userIds } }),
      Skill.deleteOne({ _id: skill?._id }),
      User.deleteMany({ _id: { $in: userIds } }),
    ]);
    await mongoose.disconnect();
  });

  test("generation creates a grounded editable plan with real mentor references", async () => {
    await request(app).post("/api/roadmaps/generate").set("Cookie", learnerCookie).send({
      targetSkillId: skill._id.toString(), goal: "Learn distributed systems well enough to build a reliable service", startDate: "2026-10-01", targetDate: "2026-09-01",
    }).expect(400);

    const response = await request(app).post("/api/roadmaps/generate").set("Cookie", learnerCookie).send({
      targetSkillId: skill._id.toString(),
      goal: "Learn distributed systems well enough to build a reliable service",
      startDate: "2026-09-01",
      targetDate: "2026-12-01",
    }).expect(201);
    roadmap = response.body.data;
    expect(roadmap.targetSkill._id).toBe(skill._id.toString());
    expect(roadmap.generationSource).toBe("deterministic");
    expect(roadmap.milestones).toHaveLength(4);
    expect(roadmap.tasks).toHaveLength(8);
    expect(roadmap.progress).toBe(0);
    expect(roadmap.mentorRecommendations.some((item) => item.user === mentor._id.toString() && item.mentor._id === mentor._id.toString())).toBe(true);

    const list = await request(app).get("/api/roadmaps").set("Cookie", learnerCookie).expect(200);
    expect(list.body.pagination.total).toBe(1);
    await request(app).get(`/api/roadmaps/${roadmap._id}`).set("Cookie", outsiderCookie).expect(404);
  });

  test("owner edits goals, milestones, and tasks while progress stays server-derived", async () => {
    const edited = await request(app).patch(`/api/roadmaps/${roadmap._id}`).set("Cookie", learnerCookie)
      .send({ goal: "Build and explain a resilient distributed service in production" }).expect(200);
    expect(edited.body.data.goal).toContain("resilient");
    expect(edited.body.data.progress).toBe(0);

    const firstTask = edited.body.data.tasks[0];
    const taskDone = await request(app).patch(`/api/roadmaps/${roadmap._id}/tasks/${firstTask._id}`).set("Cookie", learnerCookie)
      .send({ completed: true }).expect(200);
    expect(taskDone.body.data.progress).toBe(13);
    expect(taskDone.body.data.milestones[0].status).toBe("in_progress");

    const firstMilestone = taskDone.body.data.milestones[0];
    const milestoneDone = await request(app).post(`/api/roadmaps/${roadmap._id}/milestones/${firstMilestone._id}/complete`).set("Cookie", learnerCookie)
      .send({ completed: true }).expect(200);
    expect(milestoneDone.body.data.progress).toBe(25);
    expect(milestoneDone.body.data.milestones[0].completedAt).toBeTruthy();

    const added = await request(app).post(`/api/roadmaps/${roadmap._id}/milestones`).set("Cookie", learnerCookie)
      .send({ title: "Operational review", description: "Review reliability evidence" }).expect(201);
    const newMilestone = added.body.data.milestones.find((item) => item.title === "Operational review");
    expect(added.body.data.progress).toBe(22);
    const newTaskResponse = await request(app).post(`/api/roadmaps/${roadmap._id}/tasks`).set("Cookie", learnerCookie)
      .send({ milestoneId: newMilestone._id, title: "Write the operational retrospective" }).expect(201);
    const newTask = newTaskResponse.body.data.tasks.find((item) => item.title === "Write the operational retrospective");
    await request(app).patch(`/api/roadmaps/${roadmap._id}/tasks/${newTask._id}`).set("Cookie", outsiderCookie)
      .send({ completed: true }).expect(404);
    const renamed = await request(app).patch(`/api/roadmaps/${roadmap._id}/milestones/${newMilestone._id}`).set("Cookie", learnerCookie)
      .send({ title: "Production operations review" }).expect(200);
    expect(renamed.body.data.milestones.some((item) => item.title === "Production operations review")).toBe(true);
  });

  test("completing every milestone completes its tasks and the roadmap", async () => {
    let current = (await request(app).get(`/api/roadmaps/${roadmap._id}`).set("Cookie", learnerCookie).expect(200)).body.data;
    for (const milestone of current.milestones) {
      if (milestone.status !== "completed") {
        current = (await request(app).post(`/api/roadmaps/${roadmap._id}/milestones/${milestone._id}/complete`).set("Cookie", learnerCookie)
          .send({ completed: true }).expect(200)).body.data;
      }
    }
    expect(current.progress).toBe(100);
    expect(current.status).toBe("completed");
    expect(current.tasks.every((task) => task.status === "completed")).toBe(true);
  });
});
