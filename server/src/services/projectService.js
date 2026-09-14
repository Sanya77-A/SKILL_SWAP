import Project from "../models/Project.js";
import Skill from "../models/Skill.js";
import { ApiError } from "../utils/ApiError.js";

async function validateSkills(skillIds) {
  if (!skillIds) return;
  const count = await Skill.countDocuments({ _id: { $in: skillIds }, status: "active" });
  if (count !== skillIds.length) throw new ApiError(400, "INVALID_PROJECT_SKILL", "Every project skill must reference the active catalog");
}
const normalize = (payload) => {
  const value = { ...payload };
  if (value.skillIds) { value.skills = value.skillIds; delete value.skillIds; }
  return value;
};
export async function createProject(userId, payload) {
  await validateSkills(payload.skillIds);
  return Project.create({ ...normalize(payload), owner: userId });
}
export async function updateProject(userId, id, payload) {
  await validateSkills(payload.skillIds);
  const project = await Project.findOne({ _id: id, owner: userId, status: { $ne: "archived" } });
  if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found");
  Object.assign(project, normalize(payload));
  await project.save();
  return project;
}
export async function transitionProject(userId, id, action) {
  const allowed = action === "publish" ? ["draft"] : ["draft", "published"];
  const status = action === "publish" ? "published" : "archived";
  const project = await Project.findOneAndUpdate({ _id: id, owner: userId, status: { $in: allowed } }, { status }, { new: true, runValidators: true });
  if (!project) throw new ApiError(409, "INVALID_PROJECT_STATE", action === "publish" ? "Only a draft project can be published" : "Only an active project can be archived");
  return project;
}
