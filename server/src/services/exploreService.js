import Listing from "../models/Listing.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import { serializePublicUser } from "../serializers/userSerializer.js";
import { escapeRegex } from "../utils/search.js";
import { blockedUserIds } from "./safetyService.js";

const ownerFields = "name fullName username profileImage profilePhoto headline ratingAvg ratingCount skillScore location locationVisibility languages availability lastActive showLastActive profileVisibility visibility experienceLevel verificationBadges";

const visibleUserFilter = (viewerId, excluded = []) => ({
  isDeleted: false,
  isBlocked: false,
  status: "active",
  role: { $in: ["user", "mentor"] },
  ...(excluded.length ? { _id: { $nin: excluded } } : {}),
  ...(viewerId
    ? { profileVisibility: { $ne: "private" } }
    : { profileVisibility: "public" }),
});

async function eligibleOwners(filters, viewerId) {
  const excluded = await blockedUserIds(viewerId);
  const userFilter = visibleUserFilter(viewerId, excluded);
  if (filters.ratingMin != null) userFilter.ratingAvg = { $gte: filters.ratingMin };
  if (filters.language) userFilter.languages = { $regex: escapeRegex(filters.language), $options: "i" };
  if (filters.location) {
    userFilter.location = { $regex: escapeRegex(filters.location), $options: "i" };
    userFilter.locationVisibility = viewerId ? { $in: ["public", "members"] } : "public";
  }
  if (filters.availability) userFilter.availability = { $regex: escapeRegex(filters.availability), $options: "i" };
  if (filters.mentorExperience) userFilter.experienceLevel = filters.mentorExperience;

  let skillOwnerIds;
  if (filters.proficiency || filters.verification) {
    const relationFilter = { teachingEnabled: true };
    if (filters.proficiency) relationFilter.proficiency = filters.proficiency;
    if (filters.verification) relationFilter.verificationStatus = "verified";
    skillOwnerIds = await UserSkill.distinct("user", relationFilter);
    userFilter._id = { ...(userFilter._id || {}), $in: skillOwnerIds };
  }
  return User.find(userFilter).select("_id").lean().then((users) => users.map((user) => user._id));
}

function listingSort(sort) {
  return {
    best_match: { ratingAvg: -1, bookingCount: -1, publishedAt: -1 },
    highest_rated: { ratingAvg: -1, ratingCount: -1 },
    most_experienced: { bookingCount: -1, ratingAvg: -1 },
    lowest_price: { price: 1, creditCost: 1 },
    most_active: { updatedAt: -1, bookingCount: -1 },
    newest: { publishedAt: -1, _id: -1 },
  }[sort] || { ratingAvg: -1, publishedAt: -1 };
}

export async function searchMarketplace(filters, viewerId) {
  const ownerIds = await eligibleOwners(filters, viewerId);
  const listingFilter = { status: "published", owner: { $in: ownerIds } };
  if (filters.skillId) listingFilter.skill = filters.skillId;
  if (filters.experienceLevel) listingFilter.experienceLevel = filters.experienceLevel;
  if (filters.category) {
    const categorySkills = await Skill.distinct("_id", { category: filters.category, status: "active" });
    listingFilter.skill = { $in: categorySkills };
  }
  if (filters.deliveryMode === "online") listingFilter.deliveryMode = { $in: ["video", "audio"] };
  if (filters.deliveryMode === "in_person") listingFilter.deliveryMode = "in_person";
  if (filters.exchangeOnly) listingFilter.exchangeEnabled = true;
  if (filters.creditsOnly) listingFilter.creditsEnabled = true;
  if (filters.paidOnly) listingFilter.paidEnabled = true;
  if (filters.priceMin != null || filters.priceMax != null) {
    listingFilter.price = {
      ...(filters.priceMin != null && { $gte: filters.priceMin }),
      ...(filters.priceMax != null && { $lte: filters.priceMax }),
    };
  }
  if (filters.creditMax != null) listingFilter.creditCost = { $lte: filters.creditMax };

  const skillSearchFilter = { status: "active", ...(filters.category && { category: filters.category }) };
  const userSearchFilter = {
    ...visibleUserFilter(viewerId),
    _id: { $in: ownerIds, ...(viewerId && { $ne: viewerId }) },
  };
  if (filters.q) {
    const safe = escapeRegex(filters.q);
    const matchingSkillIds = await Skill.distinct("_id", {
      status: "active",
      $or: [{ name: { $regex: safe, $options: "i" } }, { aliases: { $regex: safe, $options: "i" } }, { tags: { $regex: safe, $options: "i" } }],
    });
    listingFilter.$or = [
      { title: { $regex: safe, $options: "i" } },
      { description: { $regex: safe, $options: "i" } },
      { learningOutcomes: { $regex: safe, $options: "i" } },
      { skill: { $in: matchingSkillIds } },
    ];
    skillSearchFilter.$or = [
      { name: { $regex: safe, $options: "i" } }, { aliases: { $regex: safe, $options: "i" } },
      { tags: { $regex: safe, $options: "i" } }, { description: { $regex: safe, $options: "i" } },
    ];
    userSearchFilter.$or = [
      { name: { $regex: safe, $options: "i" } }, { fullName: { $regex: safe, $options: "i" } },
      { username: { $regex: safe, $options: "i" } }, { headline: { $regex: safe, $options: "i" } },
      { skillsOffered: { $regex: safe, $options: "i" } },
    ];
  }

  const skip = (filters.page - 1) * filters.limit;
  const [listings, listingTotal, skills, mentors] = await Promise.all([
    Listing.find(listingFilter)
      .populate("owner", ownerFields)
      .populate("skill", "name slug category icon popularityScore")
      .sort(listingSort(filters.sort)).skip(skip).limit(filters.limit).lean(),
    Listing.countDocuments(listingFilter),
    Skill.find(skillSearchFilter).sort({ popularityScore: -1, name: 1 }).limit(12).lean(),
    User.find(userSearchFilter).select(ownerFields).sort({ ratingAvg: -1, lastActive: -1 }).limit(12).lean(),
  ]);

  return {
    listings: listings.map((listing) => ({ ...listing, owner: serializePublicUser(listing.owner, { viewerAuthenticated: Boolean(viewerId) }) })),
    skills,
    mentors: mentors.map((user) => serializePublicUser(user, { viewerAuthenticated: Boolean(viewerId) })),
    pagination: {
      total: listingTotal,
      page: filters.page,
      limit: filters.limit,
      pages: Math.ceil(listingTotal / filters.limit) || 1,
    },
  };
}

const listingCardPopulate = [
  { path: "owner", select: ownerFields },
  { path: "skill", select: "name slug category icon popularityScore" },
];

export async function getExploreSections(viewerId) {
  const excluded = await blockedUserIds(viewerId);
  const visibleOwners = await eligibleOwners({}, viewerId);
  const listingBase = { status: "published", owner: { $in: visibleOwners } };
  const userBase = visibleUserFilter(viewerId, excluded);
  const viewer = viewerId ? await User.findById(viewerId).select("location skillsWanted").lean() : null;
  const recommendedSkillIds = viewer?.skillsWanted?.length
    ? await Skill.distinct("_id", { name: { $in: viewer.skillsWanted }, status: "active" })
    : [];

  const queryListings = (filter, sort) => Listing.find({ ...listingBase, ...filter })
    .populate(listingCardPopulate).sort(sort).limit(8).lean();

  const [recommended, trendingSkills, topMentors, recentlyActive, beginnerFriendly, weekendAvailability, nearby, freeSkillSwaps, creditSessions, paidMentors] = await Promise.all([
    queryListings(recommendedSkillIds.length ? { skill: { $in: recommendedSkillIds } } : {}, { ratingAvg: -1, bookingCount: -1 }),
    Skill.find({ status: "active" }).sort({ popularityScore: -1, name: 1 }).limit(10).lean(),
    User.find(userBase).select(ownerFields).sort({ ratingAvg: -1, ratingCount: -1 }).limit(8).lean(),
    User.find({ ...userBase, showLastActive: { $ne: false } }).select(ownerFields).sort({ lastActive: -1 }).limit(8).lean(),
    queryListings({ experienceLevel: { $in: ["beginner", "all_levels"] } }, { ratingAvg: -1 }),
    User.find({ ...userBase, availability: { $regex: "weekend", $options: "i" } }).select(ownerFields).sort({ ratingAvg: -1 }).limit(8).lean(),
    viewer?.location ? User.find({ ...userBase, location: { $regex: escapeRegex(viewer.location), $options: "i" }, locationVisibility: { $in: ["public", "members"] } }).select(ownerFields).sort({ ratingAvg: -1 }).limit(8).lean() : [],
    queryListings({ exchangeEnabled: true }, { ratingAvg: -1 }),
    queryListings({ creditsEnabled: true }, { creditCost: 1, ratingAvg: -1 }),
    queryListings({ paidEnabled: true }, { ratingAvg: -1, bookingCount: -1 }),
  ]);

  return {
    recommended: recommended.map((listing) => ({ ...listing, owner: serializePublicUser(listing.owner, { viewerAuthenticated: Boolean(viewerId) }) })),
    trendingSkills,
    topMentors: topMentors.map((user) => serializePublicUser(user, { viewerAuthenticated: Boolean(viewerId) })),
    recentlyActive: recentlyActive.map((user) => serializePublicUser(user, { viewerAuthenticated: Boolean(viewerId) })),
    beginnerFriendly: beginnerFriendly.map((listing) => ({ ...listing, owner: serializePublicUser(listing.owner, { viewerAuthenticated: Boolean(viewerId) }) })),
    weekendAvailability: weekendAvailability.map((user) => serializePublicUser(user, { viewerAuthenticated: Boolean(viewerId) })),
    nearby: nearby.map((user) => serializePublicUser(user, { viewerAuthenticated: Boolean(viewerId) })),
    freeSkillSwaps: freeSkillSwaps.map((listing) => ({ ...listing, owner: serializePublicUser(listing.owner, { viewerAuthenticated: Boolean(viewerId) }) })),
    creditSessions: creditSessions.map((listing) => ({ ...listing, owner: serializePublicUser(listing.owner, { viewerAuthenticated: Boolean(viewerId) }) })),
    paidMentors: paidMentors.map((listing) => ({ ...listing, owner: serializePublicUser(listing.owner, { viewerAuthenticated: Boolean(viewerId) }) })),
  };
}
