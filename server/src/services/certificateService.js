import crypto from "crypto";
import Certificate from "../models/Certificate.js";
import ChallengeEnrollment from "../models/ChallengeEnrollment.js";
import Roadmap from "../models/Roadmap.js";
import { ApiError } from "../utils/ApiError.js";
import { createNotification } from "./notificationService.js";
import { createActivity } from "./activityService.js";

const refId = (value) => (value?._id || value)?.toString() || "";
const integrityPayload = (certificate) => [certificate.certificateId, refId(certificate.learner), refId(certificate.skill), refId(certificate.mentor), certificate.achievement, certificate.sourceKey || "", new Date(certificate.issuedAt).toISOString()].join("|");
const integrityHash = (certificate) => crypto.createHash("sha256").update(integrityPayload(certificate)).digest("hex");
const publicPopulate = [
  { path: "learner", select: "name fullName username profilePhoto profileImage" },
  { path: "skill", select: "name slug category icon" },
  { path: "mentor", select: "name fullName username profilePhoto profileImage" },
];

async function resolveEligibility(userId, { sourceType, sourceId, milestoneId }) {
  if (sourceType === "challenge") {
    const enrollment = await ChallengeEnrollment.findOne({ user: userId, challenge: sourceId, status: "completed" }).populate("challenge");
    if (!enrollment?.challenge) throw new ApiError(409, "CERTIFICATE_NOT_ELIGIBLE", "Complete this challenge before requesting its certificate");
    return {
      sourceKey: `challenge:${sourceId}:learner:${userId}`,
      skill: enrollment.challenge.skill,
      mentor: null,
      achievement: `Completed ${enrollment.challenge.title}`,
      completedAt: enrollment.completedAt,
      evidenceSnapshot: { challengeTitle: enrollment.challenge.title, durationDays: enrollment.challenge.durationDays, xp: enrollment.xp, badgeKey: enrollment.challenge.badge?.key || "", completedAt: enrollment.completedAt },
    };
  }
  const roadmap = await Roadmap.findOne({ _id: sourceId, user: userId });
  if (!roadmap) throw new ApiError(404, "ROADMAP_NOT_FOUND", "Roadmap not found");
  if (sourceType === "roadmap") {
    if (roadmap.status !== "completed" || roadmap.progress !== 100) throw new ApiError(409, "CERTIFICATE_NOT_ELIGIBLE", "Complete this roadmap before requesting its certificate");
    const completedAt = roadmap.milestones.map((item) => item.completedAt).filter(Boolean).sort((a, b) => b - a)[0] || roadmap.updatedAt;
    return { sourceKey: `roadmap:${sourceId}:learner:${userId}`, skill: roadmap.targetSkill, mentor: null, achievement: `Completed learning roadmap: ${roadmap.goal}`, completedAt, evidenceSnapshot: { goal: roadmap.goal, progress: roadmap.progress, milestoneCount: roadmap.milestones.length, completedAt } };
  }
  const milestone = roadmap.milestones.id(milestoneId);
  if (!milestone || milestone.status !== "completed" || !milestone.completedAt) throw new ApiError(409, "CERTIFICATE_NOT_ELIGIBLE", "Complete this milestone before requesting its certificate");
  return { sourceKey: `roadmap:${sourceId}:milestone:${milestoneId}:learner:${userId}`, skill: roadmap.targetSkill, mentor: null, achievement: `Completed milestone: ${milestone.title}`, completedAt: milestone.completedAt, evidenceSnapshot: { roadmapGoal: roadmap.goal, milestoneTitle: milestone.title, milestoneOrder: milestone.order, completedAt: milestone.completedAt } };
}

export async function issueCertificate(userId, input) {
  const eligible = await resolveEligibility(userId, input);
  const existing = await Certificate.findOne({ sourceKey: eligible.sourceKey });
  if (existing) return { certificate: existing, replayed: true };
  const issuedAt = new Date();
  const values = {
    certificateId: `SKSW-${issuedAt.getUTCFullYear()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
    learner: userId,
    skill: eligible.skill,
    mentor: eligible.mentor,
    achievement: eligible.achievement,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceMilestoneId: input.milestoneId || null,
    sourceKey: eligible.sourceKey,
    evidenceSnapshot: eligible.evidenceSnapshot,
    issuedAt,
    issuedBy: userId,
    verificationCode: crypto.randomBytes(18).toString("base64url"),
  };
  values.integrityHash = integrityHash(values);
  let certificate;
  try { certificate = await Certificate.create(values); }
  catch (error) {
    if (error?.code === 11000) {
      const replay = await Certificate.findOne({ sourceKey: eligible.sourceKey });
      if (replay) return { certificate: replay, replayed: true };
    }
    throw error;
  }
  await createNotification(userId, { type: "certificate", title: "Certificate issued", body: eligible.achievement, link: "/certificates", metadata: { certificateId: certificate.certificateId }, dedupeKey: `certificate:${certificate._id}:issued` }).catch(() => {});
  await createActivity({ actor: userId, type: "certificate_earned", title: eligible.achievement, body: "Earned a verifiable SkillSwap certificate.", link: `/verify/certificate/${certificate.certificateId}`, skill: eligible.skill, entityType: "certificate", entityId: certificate._id, visibility: "members", metadata: { certificateId: certificate.certificateId }, dedupeKey: `certificate:${certificate._id}:activity` }).catch(() => {});
  return { certificate, replayed: false };
}

export async function listMyCertificates(userId) {
  return Certificate.find({ learner: userId }).populate(publicPopulate).sort({ issuedAt: -1 }).lean();
}

export async function getEligibility(userId) {
  const [roadmaps, challengeEnrollments, certificates] = await Promise.all([
    Roadmap.find({ user: userId, $or: [{ status: "completed" }, { "milestones.status": "completed" }] }).populate("targetSkill", "name slug category icon").sort({ updatedAt: -1 }).lean(),
    ChallengeEnrollment.find({ user: userId, status: "completed" }).populate({ path: "challenge", populate: { path: "skill", select: "name slug category icon" } }).sort({ completedAt: -1 }).lean(),
    Certificate.find({ learner: userId, sourceKey: { $ne: null } }).select("sourceKey certificateId status").lean(),
  ]);
  const issued = new Map(certificates.map((item) => [item.sourceKey, { certificateId: item.certificateId, status: item.status }]));
  const sources = [];
  for (const enrollment of challengeEnrollments) if (enrollment.challenge) {
    const sourceKey = `challenge:${enrollment.challenge._id}:learner:${userId}`;
    sources.push({ sourceType: "challenge", sourceId: enrollment.challenge._id, title: enrollment.challenge.title, skill: enrollment.challenge.skill, completedAt: enrollment.completedAt, issued: issued.get(sourceKey) || null });
  }
  for (const roadmap of roadmaps) {
    if (roadmap.status === "completed" && roadmap.progress === 100) {
      const sourceKey = `roadmap:${roadmap._id}:learner:${userId}`;
      sources.push({ sourceType: "roadmap", sourceId: roadmap._id, title: roadmap.goal, skill: roadmap.targetSkill, completedAt: roadmap.updatedAt, issued: issued.get(sourceKey) || null });
    }
    for (const milestone of roadmap.milestones.filter((item) => item.status === "completed" && item.completedAt)) {
      const sourceKey = `roadmap:${roadmap._id}:milestone:${milestone._id}:learner:${userId}`;
      sources.push({ sourceType: "roadmap_milestone", sourceId: roadmap._id, milestoneId: milestone._id, title: milestone.title, context: roadmap.goal, skill: roadmap.targetSkill, completedAt: milestone.completedAt, issued: issued.get(sourceKey) || null });
    }
  }
  return sources.sort((left, right) => new Date(right.completedAt) - new Date(left.completedAt));
}

export async function verifyCertificate(identifier) {
  const raw = await Certificate.findOne({ $or: [{ certificateId: identifier.toUpperCase() }, { verificationCode: identifier }] });
  if (!raw) throw new ApiError(404, "CERTIFICATE_NOT_FOUND", "Certificate not found");
  const expectedHash = integrityHash(raw);
  const integrityValid = raw.integrityHash ? raw.integrityHash.length === expectedHash.length && crypto.timingSafeEqual(Buffer.from(raw.integrityHash), Buffer.from(expectedHash)) : null;
  await raw.populate(publicPopulate);
  const value = raw.toObject();
  return { certificateId: value.certificateId, learner: value.learner, skill: value.skill, mentor: value.mentor, achievement: value.achievement, sourceType: value.sourceType, evidenceSnapshot: value.evidenceSnapshot, issuedAt: value.issuedAt, status: value.status, revokedAt: value.revokedAt, revocationReason: value.revocationReason, integrityValid, verified: value.status === "active" && integrityValid !== false };
}

export async function revokeCertificate(id, adminId, reason) {
  const certificate = await Certificate.findOneAndUpdate({ _id: id, status: "active" }, { status: "revoked", revokedAt: new Date(), revokedBy: adminId, revocationReason: reason }, { new: true, runValidators: true });
  if (!certificate) throw new ApiError(409, "CERTIFICATE_NOT_ACTIVE", "Only an active certificate can be revoked");
  await createNotification(certificate.learner, { type: "certificate", title: "Certificate revoked", body: reason, link: "/certificates", priority: "high", metadata: { certificateId: certificate.certificateId }, dedupeKey: `certificate:${certificate._id}:revoked` }).catch(() => {});
  return certificate;
}
