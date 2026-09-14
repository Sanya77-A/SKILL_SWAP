/**
 * Idempotent Phase 3 compatibility migration.
 * Creates canonical skills/user-skill associations while preserving legacy arrays.
 * Run from server/: npm run migrate:phase3
 */
import mongoose from "mongoose";
import { env } from "../config/env.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const slugify = (value) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "skill";

const usernameBase = (value) =>
  value.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "member";

async function ensureUsername(user) {
  if (user.username) return user.username;
  const base = usernameBase(user.email.split("@")[0]);
  let candidate = base;
  let suffix = 1;
  while (await User.exists({ username: candidate, _id: { $ne: user._id } })) {
    candidate = `${base.slice(0, 24)}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function ensureSkill(name) {
  const normalizedName = name.trim();
  const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await Skill.findOne({ name: { $regex: `^${escaped}$`, $options: "i" } });
  if (existing) return existing;

  const baseSlug = slugify(normalizedName);
  let slug = baseSlug;
  let suffix = 1;
  while (await Skill.exists({ slug })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return Skill.create({ name: normalizedName, slug, category: "Community", status: "active" });
}

async function migrate() {
  await mongoose.connect(env.MONGO_URI);
  let usersMigrated = 0;
  let associationsCreated = 0;

  for await (const user of User.find({ isDeleted: false })) {
    user.fullName = user.fullName || user.name;
    user.profilePhoto = user.profilePhoto || user.profileImage;
    user.lastActive = user.lastActive || user.lastActiveAt || user.updatedAt;
    user.profileVisibility = user.profileVisibility || user.visibility || "members";
    user.username = await ensureUsername(user);
    await user.save({ validateBeforeSave: false });

    const offered = new Set((user.skillsOffered || []).map((value) => value.trim()).filter(Boolean));
    const wanted = new Set((user.skillsWanted || []).map((value) => value.trim()).filter(Boolean));
    const all = new Set([...offered, ...wanted]);

    for (const name of all) {
      const skill = await ensureSkill(name);
      const teaches = offered.has(name);
      const learns = wanted.has(name);
      const type = teaches && learns ? "both" : teaches ? "teach" : "learn";
      const result = await UserSkill.updateOne(
        { user: user._id, skill: skill._id },
        {
          $set: { type, teachingEnabled: teaches, learningEnabled: learns },
          $setOnInsert: { proficiency: "Beginner", yearsExperience: 0 },
        },
        { upsert: true, runValidators: true }
      );
      if (result.upsertedCount) associationsCreated += 1;
    }
    usersMigrated += 1;
  }

  console.log(`Phase 3 migration complete: ${usersMigrated} users, ${associationsCreated} associations created`);
  await mongoose.disconnect();
}

migrate().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
