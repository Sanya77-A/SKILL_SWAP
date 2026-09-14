import User, { calculateProfileCompleteness } from "../models/User.js";
import Skill from "../models/Skill.js";
import UserSkill from "../models/UserSkill.js";

export async function syncLegacySkillArrays(userId, skillId) {
  const [skill, record] = await Promise.all([
    Skill.findById(skillId).select("name").lean(),
    UserSkill.findOne({ user: userId, skill: skillId }).lean(),
  ]);
  if (!skill) return;

  const update = {};
  if (record?.teachingEnabled) update.$addToSet = { ...(update.$addToSet || {}), skillsOffered: skill.name };
  else update.$pull = { ...(update.$pull || {}), skillsOffered: skill.name };

  if (record?.learningEnabled) update.$addToSet = { ...(update.$addToSet || {}), skillsWanted: skill.name };
  else update.$pull = { ...(update.$pull || {}), skillsWanted: skill.name };

  await User.findByIdAndUpdate(userId, update);
  const profile = await User.findById(userId).lean();
  if (profile) {
    await User.updateOne({ _id: userId }, { profileCompleteness: calculateProfileCompleteness(profile) });
  }
}

export function duplicateKeyIsConflict(error) {
  return error?.code === 11000;
}
