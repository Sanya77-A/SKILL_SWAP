import crypto from "crypto";
import Listing from "../models/Listing.js";
import Skill from "../models/Skill.js";
import UserSkill from "../models/UserSkill.js";
import { ApiError } from "../utils/ApiError.js";

const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function validateListingOffer(payload) {
  if (!payload.exchangeEnabled && !payload.creditsEnabled && !payload.paidEnabled) {
    throw new ApiError(400, "OFFER_MODEL_REQUIRED", "Enable skill exchange, credits, or paid booking");
  }
  if (payload.creditsEnabled && !(payload.creditCost > 0)) {
    throw new ApiError(400, "CREDIT_COST_REQUIRED", "Credit-enabled listings require a positive credit cost");
  }
  if (payload.paidEnabled && !(payload.price > 0)) {
    throw new ApiError(400, "PRICE_REQUIRED", "Paid listings require a positive price");
  }
}

export async function assertTeachingSkill(ownerId, skillId) {
  const [skill, userSkill] = await Promise.all([
    Skill.findOne({ _id: skillId, status: "active" }).lean(),
    UserSkill.findOne({ user: ownerId, skill: skillId, teachingEnabled: true }).lean(),
  ]);
  if (!skill) throw new ApiError(404, "SKILL_NOT_FOUND", "Active skill not found");
  if (!userSkill) {
    throw new ApiError(403, "TEACHING_SKILL_REQUIRED", "Add this skill to your teaching profile before creating a listing");
  }
  return skill;
}

export async function createListing(ownerId, payload) {
  await assertTeachingSkill(ownerId, payload.skillId);
  validateListingOffer(payload);
  return Listing.create({
    ...payload,
    skill: payload.skillId,
    owner: ownerId,
    slug: `${slugify(payload.title)}-${crypto.randomBytes(3).toString("hex")}`,
  });
}

export async function updateOwnedListing(ownerId, listingId, payload) {
  const listing = await Listing.findOne({ _id: listingId, owner: ownerId });
  if (!listing) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing not found");
  if (listing.status === "archived") throw new ApiError(409, "LISTING_ARCHIVED", "Archived listings cannot be edited");
  if (payload.skillId && payload.skillId !== listing.skill.toString()) {
    await assertTeachingSkill(ownerId, payload.skillId);
    payload.skill = payload.skillId;
  }
  delete payload.skillId;
  Object.assign(listing, payload);
  validateListingOffer(listing);
  await listing.save();
  return listing;
}

const transitions = {
  publish: { from: ["draft", "paused"], to: "published" },
  pause: { from: ["published"], to: "paused" },
  archive: { from: ["draft", "published", "paused"], to: "archived" },
};

export async function transitionOwnedListing(ownerId, listingId, action) {
  const listing = await Listing.findOne({ _id: listingId, owner: ownerId });
  if (!listing) throw new ApiError(404, "LISTING_NOT_FOUND", "Listing not found");
  const transition = transitions[action];
  if (!transition?.from.includes(listing.status)) {
    throw new ApiError(409, "INVALID_LISTING_TRANSITION", `Cannot ${action} a ${listing.status} listing`);
  }
  if (action === "publish") {
    await assertTeachingSkill(ownerId, listing.skill);
    validateListingOffer(listing);
    if (!listing.learningOutcomes.length || !listing.deliveryMode.length || !listing.sessionDurations.length) {
      throw new ApiError(400, "LISTING_INCOMPLETE", "Add outcomes, delivery modes, and durations before publishing");
    }
    listing.publishedAt ||= new Date();
  }
  listing.status = transition.to;
  await listing.save();
  return listing;
}
