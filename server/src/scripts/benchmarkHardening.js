import mongoose from "mongoose";
import { performance } from "node:perf_hooks";
import { env } from "../config/env.js";

const count = (name, fallback) => Number(process.env[`BENCH_${name}`] || fallback);
const scale = {
  users: count("USERS", 2000), skills: count("SKILLS", 200), listings: count("LISTINGS", 4000),
  bookings: count("BOOKINGS", 5000), reviews: count("REVIEWS", 10000), messages: count("MESSAGES", 20000),
};
const oid = (value) => new mongoose.Types.ObjectId(value.toString(16).padStart(24, "0"));
const now = new Date("2026-08-23T00:00:00.000Z");

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function timed(name, run, explain) {
  await run();
  const samples = [];
  for (let index = 0; index < 7; index += 1) { const start = performance.now(); await run(); samples.push(performance.now() - start); }
  const plan = await explain();
  return { name, medianMs: Number(median(samples).toFixed(2)), docsExamined: plan.executionStats.totalDocsExamined, keysExamined: plan.executionStats.totalKeysExamined, returned: plan.executionStats.nReturned, winningPlan: JSON.stringify(plan.queryPlanner.winningPlan).includes("COLLSCAN") ? "COLLSCAN" : "INDEXED" };
}

async function run() {
  const connection = await mongoose.createConnection(env.MONGO_URI, { dbName: "skillswap_benchmark" }).asPromise();
  const db = connection.db;
  await db.dropDatabase();
  const users = db.collection("users"); const skills = db.collection("skills"); const listings = db.collection("listings");
  const userSkills = db.collection("userskills"); const bookings = db.collection("bookings"); const reviews = db.collection("reviews");
  const conversations = db.collection("conversations"); const messages = db.collection("messages"); const notifications = db.collection("notifications");
  const userDocs = Array.from({ length: scale.users }, (_, index) => ({ _id: oid(index + 1), name: `Benchmark User ${index}`, username: `benchmark-${index}`, status: "active", role: index % 8 ? "user" : "mentor", isDeleted: false, isBlocked: false, profileVisibility: "public", ratingAvg: 3 + (index % 20) / 10, ratingCount: index % 40, createdAt: now }));
  const skillDocs = Array.from({ length: scale.skills }, (_, index) => ({ _id: oid(100000 + index), name: `Skill ${index}`, slug: `skill-${index}`, status: "active", popularity: scale.skills - index }));
  await users.insertMany(userDocs); await skills.insertMany(skillDocs);
  await listings.insertMany(Array.from({ length: scale.listings }, (_, index) => ({ _id: oid(200000 + index), owner: userDocs[index % scale.users]._id, skill: skillDocs[index % scale.skills]._id, status: "published", deliveryMode: index % 2 ? "video" : "in_person", creditCost: index % 100, createdAt: new Date(now.getTime() - index * 1000) })));
  await userSkills.insertMany(Array.from({ length: scale.users * 4 }, (_, index) => ({ user: userDocs[index % scale.users]._id, skill: skillDocs[index % scale.skills]._id, teachingEnabled: index % 2 === 0, learningEnabled: index % 3 === 0 })));
  await bookings.insertMany(Array.from({ length: scale.bookings }, (_, index) => ({ _id: oid(400000 + index), teacher: userDocs[index % scale.users]._id, student: userDocs[(index + 1) % scale.users]._id, skill: skillDocs[index % scale.skills]._id, status: ["confirmed", "completed", "cancelled"][index % 3], startAt: new Date(now.getTime() + index * 900000), createdAt: now })));
  await reviews.insertMany(Array.from({ length: scale.reviews }, (_, index) => ({ _id: oid(500000 + index), reviewee: userDocs[index % scale.users]._id, reviewer: userDocs[(index + 1) % scale.users]._id, rating: 3 + (index % 3), status: "published", createdAt: new Date(now.getTime() - index * 1000) })));
  const conversationDocs = Array.from({ length: Math.ceil(scale.messages / 20) }, (_, index) => ({ _id: oid(700000 + index), participants: [userDocs[index % scale.users]._id, userDocs[(index + 1) % scale.users]._id], lastMessageAt: now }));
  await conversations.insertMany(conversationDocs);
  await messages.insertMany(Array.from({ length: scale.messages }, (_, index) => ({ _id: oid(800000 + index), conversation: conversationDocs[index % conversationDocs.length]._id, sender: userDocs[index % scale.users]._id, content: `Benchmark message ${index}`, createdAt: new Date(now.getTime() + index) })));
  await notifications.insertMany(Array.from({ length: Math.floor(scale.messages / 2) }, (_, index) => ({ _id: oid(1200000 + index), user: userDocs[index % scale.users]._id, read: index % 3 === 0, createdAt: new Date(now.getTime() + index) })));

  await Promise.all([
    users.createIndex({ username: 1 }, { unique: true }), users.createIndex({ status: 1, role: 1, ratingAvg: -1 }),
    skills.createIndex({ status: 1, popularity: -1 }), listings.createIndex({ status: 1, skill: 1, deliveryMode: 1, createdAt: -1 }),
    userSkills.createIndex({ skill: 1, teachingEnabled: 1, user: 1 }), bookings.createIndex({ teacher: 1, status: 1, startAt: 1 }),
    reviews.createIndex({ reviewee: 1, status: 1, createdAt: -1 }), notifications.createIndex({ user: 1, read: 1, createdAt: -1 }),
    messages.createIndex({ conversation: 1, createdAt: -1 }), conversations.createIndex({ participants: 1, lastMessageAt: -1 }),
  ]);

  const targetUser = userDocs[0]._id; const targetSkill = skillDocs[12]._id; const targetConversation = conversationDocs[0]._id;
  const cases = [
    await timed("explore mentors", () => users.find({ status: "active", role: { $in: ["user", "mentor"] } }).sort({ ratingAvg: -1 }).limit(20).toArray(), () => users.find({ status: "active", role: { $in: ["user", "mentor"] } }).sort({ ratingAvg: -1 }).limit(20).explain("executionStats")),
    await timed("skill search", () => skills.find({ status: "active" }).sort({ popularity: -1 }).limit(20).toArray(), () => skills.find({ status: "active" }).sort({ popularity: -1 }).limit(20).explain("executionStats")),
    await timed("listing filters", () => listings.find({ status: "published", skill: targetSkill, deliveryMode: "in_person" }).sort({ createdAt: -1 }).limit(20).toArray(), () => listings.find({ status: "published", skill: targetSkill, deliveryMode: "in_person" }).sort({ createdAt: -1 }).limit(20).explain("executionStats")),
    await timed("public profile", () => users.findOne({ username: "benchmark-100", status: "active" }), () => users.find({ username: "benchmark-100", status: "active" }).limit(1).explain("executionStats")),
    await timed("match candidates", () => userSkills.find({ skill: targetSkill, teachingEnabled: true }).limit(100).toArray(), () => userSkills.find({ skill: targetSkill, teachingEnabled: true }).limit(100).explain("executionStats")),
    await timed("booking calendar", () => bookings.find({ teacher: targetUser, status: { $in: ["confirmed", "upcoming"] } }).sort({ startAt: 1 }).limit(50).toArray(), () => bookings.find({ teacher: targetUser, status: { $in: ["confirmed", "upcoming"] } }).sort({ startAt: 1 }).limit(50).explain("executionStats")),
    await timed("notifications", () => notifications.find({ user: targetUser, read: false }).sort({ createdAt: -1 }).limit(20).toArray(), () => notifications.find({ user: targetUser, read: false }).sort({ createdAt: -1 }).limit(20).explain("executionStats")),
    await timed("conversation history", () => messages.find({ conversation: targetConversation }).sort({ createdAt: -1 }).limit(20).toArray(), () => messages.find({ conversation: targetConversation }).sort({ createdAt: -1 }).limit(20).explain("executionStats")),
  ];
  process.stdout.write(`${JSON.stringify({ dataset: scale, repeatedSamples: 7, cases }, null, 2)}\n`);
  await db.dropDatabase();
  await connection.close();
}

run().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
