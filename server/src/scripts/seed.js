/**
 * Idempotent, non-destructive SkillSwap demo seed.
 * Run from server/: npm run seed
 * Production requires the explicit ALLOW_PRODUCTION_SEED=true acknowledgement.
 */
import crypto from "crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";

import AvailabilityRule from "../models/AvailabilityRule.js";
import Booking from "../models/Booking.js";
import Community from "../models/Community.js";
import CommunityMembership from "../models/CommunityMembership.js";
import CommunityPost from "../models/CommunityPost.js";
import CreditTransaction from "../models/CreditTransaction.js";
import Listing from "../models/Listing.js";
import Notification from "../models/Notification.js";
import Project from "../models/Project.js";
import Review from "../models/Review.js";
import Roadmap from "../models/Roadmap.js";
import Skill from "../models/Skill.js";
import SwapProposal from "../models/SwapProposal.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";
import Wallet from "../models/Wallet.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "SkillSwapDemo!2026";
const now = new Date();
const day = 86_400_000;
const at = (offset, hour = 14) => {
  const value = new Date(now.getTime() + offset * day);
  value.setUTCHours(hour, 0, 0, 0);
  return value;
};
const stableId = (key) => new mongoose.Types.ObjectId(crypto.createHash("sha256").update(`skillswap-demo:${key}`).digest("hex").slice(0, 24));

const personas = [
  { key: "rhea", name: "Rhea Kapoor", username: "rhea_ops", email: "rhea.ops@demo.skillswap.local", role: "admin", occupation: "Marketplace operations lead", company: "SkillSwap", location: "Pune, India", timezone: "Asia/Kolkata", languages: ["English", "Hindi"], experienceLevel: "expert", headline: "Trust, quality, and operations for learning marketplaces", bio: "Rhea builds fair operating systems for communities where expertise, safety, and opportunity need to scale together.", offers: ["Community Operations", "Public Speaking"], wants: ["Italian Conversation"], availability: ["weekday evenings"], modes: ["online"], exchange: ["exchange", "credits"] },
  { key: "aarav", name: "Aarav Mehta", username: "aarav_builds", email: "aarav@demo.skillswap.local", role: "mentor", occupation: "Full-stack developer", company: "Cedar Labs", location: "Mumbai, India", timezone: "Asia/Kolkata", languages: ["English", "Hindi", "Gujarati"], experienceLevel: "advanced", headline: "Full-stack engineer helping teams ship dependable web products", bio: "Aarav has spent seven years turning ambiguous product ideas into maintainable React and Node.js systems. He teaches through code reviews and small production-minded exercises.", offers: ["React", "Node.js", "System Design"], wants: ["Product Design", "Piano"], availability: ["weekday evenings", "Saturday mornings"], modes: ["online", "hybrid"], exchange: ["exchange", "credits", "paid"] },
  { key: "maya", name: "Maya Iyer", username: "maya_shapes", email: "maya@demo.skillswap.local", role: "mentor", occupation: "Product designer", company: "Northstar Health", location: "Bengaluru, India", timezone: "Asia/Kolkata", languages: ["English", "Tamil"], experienceLevel: "expert", headline: "Product designer translating research into calm, useful interfaces", bio: "Maya leads end-to-end product design for healthcare teams. Her sessions combine critique, systems thinking, accessibility, and practical Figma workflows.", offers: ["Product Design", "Figma", "UX Research"], wants: ["Data Analysis", "Italian Conversation"], availability: ["Tuesday evenings", "Sunday afternoons"], modes: ["online"], exchange: ["exchange", "credits", "paid"] },
  { key: "leo", name: "Leo Martínez", username: "leo_grows", email: "leo@demo.skillswap.local", role: "mentor", occupation: "Growth marketer", company: "Mercado Norte", location: "Madrid, Spain", timezone: "Europe/Madrid", languages: ["Spanish", "English"], experienceLevel: "advanced", headline: "Evidence-led growth for products with a real point of view", bio: "Leo helps small product teams find durable acquisition loops. He prefers clear experiments, honest positioning, and dashboards that answer one decision at a time.", offers: ["Growth Marketing", "SEO", "Content Strategy"], wants: ["Photography", "Python"], availability: ["weekday mornings", "Friday afternoons"], modes: ["online"], exchange: ["credits", "paid"] },
  { key: "nia", name: "Nia Okafor", username: "nia_frames", email: "nia@demo.skillswap.local", role: "mentor", occupation: "Portrait photographer", company: "Independent", location: "Lagos, Nigeria", timezone: "Africa/Lagos", languages: ["English", "Igbo"], experienceLevel: "expert", headline: "Portrait photographer teaching light, direction, and visual trust", bio: "Nia photographs founders and artists with a documentary eye. She teaches repeatable lighting decisions, respectful direction, and edits that keep skin looking real.", offers: ["Photography", "Photo Editing"], wants: ["Growth Marketing", "Music Production"], availability: ["Wednesday afternoons", "Saturday afternoons"], modes: ["online", "in_person"], exchange: ["exchange", "credits", "paid"] },
  { key: "emi", name: "Emi Tanaka", username: "emi_keys", email: "emi@demo.skillswap.local", role: "mentor", occupation: "Jazz pianist and arranger", company: "Blue Room Collective", location: "Tokyo, Japan", timezone: "Asia/Tokyo", languages: ["Japanese", "English"], experienceLevel: "expert", headline: "Jazz piano, practical harmony, and arranging without intimidation", bio: "Emi performs, arranges, and teaches working musicians. Her lessons connect ear training to usable voicings and leave learners with a focused weekly practice plan.", offers: ["Piano", "Music Theory"], wants: ["English Conversation", "Photography"], availability: ["Monday evenings", "Sunday mornings"], modes: ["video", "audio"], exchange: ["exchange", "credits", "paid"] },
  { key: "sofia", name: "Sofia Rossi", username: "sofia_parla", email: "sofia@demo.skillswap.local", role: "mentor", occupation: "Language tutor", company: "Parla Studio", location: "Bologna, Italy", timezone: "Europe/Rome", languages: ["Italian", "English", "French"], experienceLevel: "advanced", headline: "Practical Italian for travel, work, and everyday confidence", bio: "Sofia designs conversation-led lessons around the situations learners actually face. She gives precise feedback without interrupting the rhythm of speaking.", offers: ["Italian Conversation", "English Conversation"], wants: ["Content Strategy", "Piano"], availability: ["weekday mornings", "Saturday mornings"], modes: ["online"], exchange: ["exchange", "credits", "paid"] },
  { key: "samira", name: "Samira Khan", username: "samira_learns", email: "samira@demo.skillswap.local", role: "user", occupation: "Data science student", university: "Delhi Technological University", location: "Delhi, India", timezone: "Asia/Kolkata", languages: ["English", "Hindi", "Urdu"], experienceLevel: "intermediate", headline: "Data science student building useful analysis projects", bio: "Samira is strengthening her statistical foundations while building a public portfolio. She can help beginners with Python notebooks and thoughtful study systems.", offers: ["Python", "Study Skills"], wants: ["Data Analysis", "Public Speaking"], availability: ["weekday evenings", "weekends"], modes: ["online"], exchange: ["exchange", "credits"] },
  { key: "jonas", name: "Jonas Berg", username: "jonas_founder", email: "jonas@demo.skillswap.local", role: "mentor", occupation: "SaaS founder", company: "Fieldnote", location: "Stockholm, Sweden", timezone: "Europe/Stockholm", languages: ["Swedish", "English"], experienceLevel: "expert", headline: "Early-stage founder focused on customer clarity and sustainable execution", bio: "Jonas has taken two B2B products from interviews to recurring revenue. He mentors founders on discovery, positioning, prioritisation, and honest operating cadence.", offers: ["Startup Strategy", "Product Strategy"], wants: ["Public Speaking", "Photography"], availability: ["Thursday afternoons", "Sunday evenings"], modes: ["online"], exchange: ["credits", "paid"] },
  { key: "priya", name: "Priya Nair", username: "priya_research", email: "priya@demo.skillswap.local", role: "mentor", occupation: "UX researcher", company: "Transit Commons", location: "Singapore", timezone: "Asia/Singapore", languages: ["English", "Malayalam"], experienceLevel: "advanced", headline: "UX researcher making complex services easier to understand", bio: "Priya plans lean research, facilitates careful interviews, and helps teams separate evidence from assumption. She is especially interested in public-interest products.", offers: ["UX Research", "Product Strategy"], wants: ["Data Analysis", "Photo Editing"], availability: ["Tuesday mornings", "Saturday mornings"], modes: ["online"], exchange: ["exchange", "credits"] },
  { key: "daniel", name: "Daniel Brooks", username: "daniel_mixes", email: "daniel@demo.skillswap.local", role: "mentor", occupation: "Audio producer", company: "Harbour Sound", location: "Toronto, Canada", timezone: "America/Toronto", languages: ["English"], experienceLevel: "advanced", headline: "Music producer helping creators finish clear, balanced mixes", bio: "Daniel works with independent songwriters and podcasters. His teaching is practical: arrangement first, signal flow second, and plugins only when they solve a named problem.", offers: ["Music Production", "Audio Editing"], wants: ["SEO", "Product Design"], availability: ["weekday afternoons", "Saturday evenings"], modes: ["online", "in_person"], exchange: ["exchange", "credits", "paid"] },
  { key: "amina", name: "Amina El-Sayed", username: "amina_stories", email: "amina@demo.skillswap.local", role: "mentor", occupation: "Brand strategist and creator", company: "Common Thread", location: "Cairo, Egypt", timezone: "Africa/Cairo", languages: ["Arabic", "English"], experienceLevel: "advanced", headline: "Brand strategy and content systems for thoughtful creators", bio: "Amina helps independent creators turn scattered ideas into a recognisable editorial voice. She teaches positioning through real audience questions, not empty slogans.", offers: ["Content Strategy", "Brand Strategy", "Public Speaking"], wants: ["Video Editing", "Startup Strategy"], availability: ["Monday afternoons", "Friday mornings"], modes: ["online"], exchange: ["exchange", "credits", "paid"] },
  { key: "mateo", name: "Mateo Silva", username: "mateo_mobile", email: "mateo@demo.skillswap.local", role: "user", occupation: "Mobile developer", company: "Freelance", location: "São Paulo, Brazil", timezone: "America/Sao_Paulo", languages: ["Portuguese", "English"], experienceLevel: "intermediate", headline: "Mobile developer learning to connect engineering and product craft", bio: "Mateo builds React Native applications for small businesses. He enjoys pairing on debugging and wants stronger product discovery and visual storytelling skills.", offers: ["React", "Mobile Development"], wants: ["UX Research", "Photography"], availability: ["weekday evenings", "Sunday afternoons"], modes: ["online"], exchange: ["exchange", "credits"] },
];

const skillCatalog = [
  ["React", "react", "Technology"], ["Node.js", "node-js", "Technology"], ["System Design", "system-design", "Technology"], ["Python", "python", "Technology"], ["Data Analysis", "data-analysis", "Data"], ["Mobile Development", "mobile-development", "Technology"],
  ["Product Design", "product-design", "Design"], ["Figma", "figma", "Design"], ["UX Research", "ux-research", "Design"], ["Product Strategy", "product-strategy", "Business"], ["Startup Strategy", "startup-strategy", "Business"],
  ["Growth Marketing", "growth-marketing", "Marketing"], ["SEO", "seo", "Marketing"], ["Content Strategy", "content-strategy", "Marketing"], ["Brand Strategy", "brand-strategy", "Marketing"],
  ["Photography", "photography", "Creative"], ["Photo Editing", "photo-editing", "Creative"], ["Video Editing", "video-editing", "Creative"], ["Piano", "piano", "Music"], ["Music Theory", "music-theory", "Music"], ["Music Production", "music-production", "Music"], ["Audio Editing", "audio-editing", "Music"],
  ["Italian Conversation", "italian-conversation", "Languages"], ["English Conversation", "english-conversation", "Languages"], ["Public Speaking", "public-speaking", "Professional Skills"], ["Study Skills", "study-skills", "Education"], ["Community Operations", "community-operations", "Business"],
];

const listingSpecs = [
  ["aarav", "React", "production-react-review", "Production-minded React code review", "Bring a real component or pull request. We will trace state, rendering, accessibility, and maintenance risks together.", ["Identify avoidable render work", "Improve component boundaries", "Leave with a prioritised refactor plan"], ["video"], true, true, true, 28, 42, 4.8, 19],
  ["maya", "Product Design", "product-critique-with-maya", "Product critique for one difficult workflow", "A structured critique for a workflow that feels crowded, unclear, or hard to trust. We will work from user intent to interaction detail.", ["Clarify the primary user decision", "Find hierarchy and accessibility gaps", "Define the next design iteration"], ["video"], true, true, true, 32, 55, 4.9, 24],
  ["leo", "Growth Marketing", "growth-experiment-clinic", "Growth experiment clinic for early products", "Turn a broad growth goal into one measurable experiment with a credible audience, channel, and stopping rule.", ["Choose a useful leading indicator", "Write a testable hypothesis", "Plan a lightweight experiment"], ["video"], false, true, true, 30, 48, 4.5, 13],
  ["nia", "Photography", "natural-portrait-light", "Natural portrait light and direction", "Learn to read a room, place a subject, and direct a portrait without flattening personality or over-editing skin.", ["Recognise useful window light", "Give clear subject direction", "Build a restrained edit"], ["video", "in_person"], true, true, true, 35, 60, 4.7, 17],
  ["emi", "Piano", "jazz-voicings-in-context", "Jazz voicings you can use in a song", "A practical piano session connecting melody, shell voicings, and voice leading to music you already know.", ["Build two reliable voicing shapes", "Move smoothly through a progression", "Create a one-week practice loop"], ["video", "audio"], true, true, true, 24, 38, 4.9, 31],
  ["sofia", "Italian Conversation", "italian-conversation-real-life", "Italian conversation for real-life situations", "Conversation practice built around travel, work, family, or relocation, with focused feedback after each speaking round.", ["Speak for longer without translating", "Correct recurring grammar patterns", "Build situation-specific vocabulary"], ["video", "audio"], true, true, true, 18, 30, 4.6, 22],
  ["jonas", "Startup Strategy", "founder-customer-clarity", "Founder clinic: customer and problem clarity", "Pressure-test what you believe about your customer and leave with sharper interview questions and a narrower next decision.", ["Separate evidence from assumptions", "Improve customer interview prompts", "Choose the next product risk"], ["video"], false, true, true, 45, 85, 4.4, 9],
  ["priya", "UX Research", "lean-interview-plan", "Design a lean user interview plan", "Build a focused research plan that fits a small team, avoids leading questions, and produces decisions rather than a transcript archive.", ["Define a research decision", "Write neutral interview prompts", "Plan lightweight synthesis"], ["video"], true, true, false, 26, 0, 4.7, 15],
  ["daniel", "Music Production", "finish-your-mix", "Finish a mix without chasing plugins", "Review arrangement, balance, space, and references in that order so your next mix decisions stay deliberate.", ["Find the dominant mix problem", "Use a reference track productively", "Build a finish checklist"], ["video", "audio"], true, true, true, 27, 45, 4.3, 11],
  ["amina", "Content Strategy", "creator-editorial-system", "Build a sustainable creator editorial system", "Turn audience questions and lived expertise into a focused content system you can maintain without posting every day.", ["Choose three durable themes", "Create a repeatable format", "Plan one month of useful work"], ["video"], true, true, true, 25, 44, 4.6, 16],
];

async function upsertUsers() {
  const result = new Map();
  for (const persona of personas) {
    const values = {
      _id: stableId(`user:${persona.key}`), name: persona.name, fullName: persona.name, username: persona.username, email: persona.email,
      headline: persona.headline, bio: persona.bio, occupation: persona.occupation, company: persona.company || "", university: persona.university || "",
      location: persona.location, timezone: persona.timezone, languages: persona.languages, availability: persona.availability,
      profilePhoto: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(persona.name)}`,
      visibility: "public", profileVisibility: "public", locationVisibility: "members", messagePermissions: "matches",
      preferredLearningMode: "online", preferredTeachingMode: persona.modes.includes("in_person") ? "hybrid" : "online",
      preferredLearningModes: ["online"], preferredTeachingModes: persona.modes.includes("in_person") ? ["online", "in_person"] : ["online"],
      preferredExchangeModels: persona.exchange, preferredCurrency: persona.location.includes("India") ? "INR" : "USD",
      learningGoals: [`Build practical confidence in ${persona.wants[0]}`, "Complete one evidence-backed learning project"],
      onboardingCompleted: true, experienceLevel: persona.experienceLevel, skillsOffered: persona.offers, skillsWanted: persona.wants,
      role: persona.role, status: "active", isBlocked: false, isDeleted: false, emailVerified: true,
      lastActive: at(-(personas.indexOf(persona) % 6), 9 + (personas.indexOf(persona) % 8)),
      responseTimeMinutes: 35 + personas.indexOf(persona) * 17,
    };
    let user = await User.findOne({ $or: [{ email: persona.email }, { username: persona.username }] }).select("+password");
    if (!user) user = new User({ ...values, password: DEMO_PASSWORD });
    else Object.assign(user, values, { _id: user._id, password: DEMO_PASSWORD });
    await user.save();
    result.set(persona.key, user);
  }
  return result;
}

async function upsertSkills() {
  const result = new Map();
  for (const [name, slug, category] of skillCatalog) {
    const skill = await Skill.findOneAndUpdate({ slug }, { $set: { name, slug, category, status: "active", description: `${name} guidance, practice, and evidence-based peer learning.`, tags: [category.toLowerCase(), "peer-learning"], popularityScore: 45 + skillCatalog.findIndex((item) => item[0] === name) * 3 } }, { upsert: true, new: true, runValidators: true });
    result.set(name, skill);
  }
  return result;
}

async function seedUserSkills(users, skills) {
  for (const persona of personas) {
    const names = [...new Set([...persona.offers, ...persona.wants])];
    for (const name of names) {
      const teaches = persona.offers.includes(name);
      const learns = persona.wants.includes(name);
      const type = teaches && learns ? "both" : teaches ? "teach" : "learn";
      const yearsExperience = teaches ? Math.max(2, 3 + personas.indexOf(persona) % 8) : Math.min(2, personas.indexOf(persona) % 3);
      await UserSkill.findOneAndUpdate({ user: users.get(persona.key)._id, skill: skills.get(name)._id }, { $set: {
        type, proficiency: teaches ? (persona.experienceLevel === "expert" ? "Expert" : "Advanced") : "Beginner",
        yearsExperience, teachingEnabled: teaches, learningEnabled: learns,
        verificationStatus: teaches && persona.role === "mentor" ? "verified" : "unverified",
        description: teaches ? `${persona.name} teaches ${name} through focused practice and concrete feedback.` : `${persona.name} is actively building confidence in ${name}.`,
        evidence: teaches ? [{ type: "portfolio", label: "Selected work", url: `https://example.com/${persona.username}/${skills.get(name).slug}` }] : [],
      } }, { upsert: true, new: true, runValidators: true });
    }
  }
}

async function seedListings(users, skills) {
  const result = new Map();
  for (const [ownerKey, skillName, slug, title, description, outcomes, modes, exchangeEnabled, creditsEnabled, paidEnabled, creditCost, price, ratingAvg, ratingCount] of listingSpecs) {
    const listing = await Listing.findOneAndUpdate({ slug }, { $set: {
      owner: users.get(ownerKey)._id, skill: skills.get(skillName)._id, slug, title, description, learningOutcomes: outcomes,
      prerequisites: ["Bring one concrete goal or work sample"], experienceLevel: "all_levels", deliveryMode: modes, sessionDurations: [45, 60],
      exchangeEnabled, creditsEnabled, paidEnabled, creditCost, price, currency: "USD", status: "published", ratingAvg, ratingCount,
      bookingCount: ratingCount + 7, publishedAt: at(-120 + listingSpecs.findIndex((item) => item[2] === slug) * 7),
    } }, { upsert: true, new: true, runValidators: true });
    result.set(slug, listing);
  }
  return result;
}

async function seedAvailability(users) {
  const mentorKeys = personas.filter((persona) => persona.role === "mentor").map((persona) => persona.key);
  for (const [index, key] of mentorKeys.entries()) {
    for (const dayOfWeek of [2 + (index % 3), 6]) {
      await AvailabilityRule.findOneAndUpdate({ user: users.get(key)._id, dayOfWeek, startTime: index % 2 ? "14:00" : "09:00", endTime: index % 2 ? "17:00" : "12:00" }, { $set: { timezone: users.get(key).timezone, modes: ["video"], isActive: true } }, { upsert: true, new: true, runValidators: true });
    }
  }
}

async function seedBookings(users, skills, listings) {
  const specs = [
    { key: "react-samira", requester: "samira", recipient: "aarav", offered: "Study Skills", requested: "React", listing: "production-react-review", start: -18, status: "completed", credits: 28 },
    { key: "design-mateo", requester: "mateo", recipient: "maya", offered: "Mobile Development", requested: "Product Design", listing: "product-critique-with-maya", start: -9, status: "completed", credits: 32 },
    { key: "italian-emi", requester: "emi", recipient: "sofia", offered: "Piano", requested: "Italian Conversation", listing: "italian-conversation-real-life", start: 4, status: "confirmed", credits: 18 },
    { key: "growth-nia", requester: "nia", recipient: "leo", offered: "Photography", requested: "Growth Marketing", listing: "growth-experiment-clinic", start: -3, status: "no_show", credits: 30 },
    { key: "research-jonas", requester: "jonas", recipient: "priya", offered: "Startup Strategy", requested: "UX Research", listing: "lean-interview-plan", start: 9, status: "cancelled", credits: 26 },
  ];
  const result = new Map();
  for (const spec of specs) {
    const proposalId = stableId(`proposal:${spec.key}`);
    const startAt = at(spec.start, 13);
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    await SwapProposal.findOneAndUpdate({ _id: proposalId }, { $set: {
      requester: users.get(spec.requester)._id, recipient: users.get(spec.recipient)._id, listing: listings.get(spec.listing)._id,
      offeredSkill: skills.get(spec.offered)._id, requestedSkill: skills.get(spec.requested)._id, offeredSessions: 1, requestedSessions: 1,
      duration: 60, proposedSchedule: [{ startAt, endAt, timezone: users.get(spec.requester).timezone }], deliveryMode: "video",
      message: `I would like to build practical ${spec.requested} skills and can offer ${spec.offered} in return.`, optionalCredits: spec.credits,
      status: "accepted", actionRequiredBy: null, acceptedAt: at(spec.start - 8), respondedAt: at(spec.start - 8), expiresAt: at(spec.start + 14),
      revisions: [{ actor: users.get(spec.requester)._id, offeredSessions: 1, requestedSessions: 1, duration: 60, proposedSchedule: [{ startAt, endAt, timezone: users.get(spec.requester).timezone }], deliveryMode: "video", optionalCredits: spec.credits, message: "Proposed learning exchange", createdAt: at(spec.start - 10) }],
    } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    const bookingId = stableId(`booking:${spec.key}`);
    const booking = await Booking.findOneAndUpdate({ _id: bookingId }, { $set: {
      bookingCode: `DEMO-${spec.key.replaceAll("-", "").toUpperCase()}`, proposal: proposalId, listing: listings.get(spec.listing)._id,
      leg: "requested", sequence: 1, teacher: users.get(spec.recipient)._id, student: users.get(spec.requester)._id,
      skill: skills.get(spec.requested)._id, startAt, endAt, duration: 60, timezone: users.get(spec.requester).timezone,
      teacherTimezone: users.get(spec.recipient).timezone, studentTimezone: users.get(spec.requester).timezone, mode: "video",
      meetingUrl: spec.status === "cancelled" ? "" : "https://meet.example.com/skillswap-demo", status: spec.status,
      confirmationRequiredBy: null, paymentModel: "credits", creditAmount: spec.credits,
      completedAt: spec.status === "completed" ? endAt : null, cancelReason: spec.status === "cancelled" ? "Schedule changed before confirmation" : "",
      cancelledBy: spec.status === "cancelled" ? users.get(spec.requester)._id : null,
    } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    result.set(spec.key, booking);
  }
  return result;
}

async function seedReviews(users, bookings) {
  const specs = [
    ["samira", "aarav", "react-samira", { communication: 5, knowledge: 5, teaching: 4, punctuality: 5, professionalism: 5, overall: 4.7 }, "Aarav traced the actual state bug with me and explained why the refactor mattered. I left with a smaller, testable next step.", true],
    ["mateo", "maya", "design-mateo", { communication: 5, knowledge: 5, teaching: 5, punctuality: 4, professionalism: 5, overall: 4.8 }, "Maya challenged the hierarchy without redesigning the screen for me. The critique was direct, specific, and immediately useful.", true],
    ["aarav", "samira", "react-samira", { communication: 4, knowledge: 4, teaching: 4, punctuality: 5, professionalism: 5, overall: 4.4 }, "Samira shared a thoughtful study system and adapted it to a busy engineering week. Practical and easy to maintain.", true],
  ];
  for (const [reviewer, reviewee, bookingKey, ratings, comment, wouldLearnAgain] of specs) {
    await Review.findOneAndUpdate({ reviewer: users.get(reviewer)._id, session: bookings.get(bookingKey)._id }, { $set: {
      reviewer: users.get(reviewer)._id, reviewee: users.get(reviewee)._id, session: bookings.get(bookingKey)._id,
      ratings, comment, wouldLearnAgain, author: users.get(reviewer)._id, recipient: users.get(reviewee)._id,
      rating: ratings.overall, moderationStatus: "visible",
    } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  }
  const reputation = [
    ["aarav", 4.7, 18, 4.8, 21, 86], ["maya", 4.8, 23, 4.9, 27, 91], ["leo", 4.5, 12, 4.5, 16, 78], ["nia", 4.7, 16, 4.7, 19, 84],
    ["emi", 4.9, 29, 4.9, 34, 94], ["sofia", 4.6, 21, 4.7, 25, 83], ["jonas", 4.4, 8, 4.5, 11, 75], ["priya", 4.7, 14, 4.8, 18, 87],
    ["daniel", 4.3, 10, 4.4, 13, 72], ["amina", 4.6, 15, 4.7, 20, 82], ["samira", 4.4, 4, 4.4, 7, 64], ["mateo", 4.2, 3, 4.2, 6, 61],
  ];
  for (const [key, ratingAvg, ratingCount, overall, sessionsCompleted, skillScore] of reputation) {
    await User.updateOne({ _id: users.get(key)._id }, { $set: { ratingAvg, ratingCount, sessionsCompleted, skillScore, reputation: { communication: overall, knowledge: overall, teaching: Math.max(1, overall - 0.1), punctuality: Math.min(5, overall + 0.1), professionalism: overall, overall, wouldLearnAgainRate: 78 + (ratingCount % 19), updatedAt: now } } });
  }
}

async function seedWallets(users, bookings) {
  const extras = {
    aarav: [{ amount: 28, type: "teaching_reward", entity: bookings.get("react-samira")._id, description: "Teaching reward for React review" }],
    maya: [{ amount: 32, type: "teaching_reward", entity: bookings.get("design-mateo")._id, description: "Teaching reward for product critique" }],
    samira: [{ amount: -28, type: "booking_spend", entity: bookings.get("react-samira")._id, description: "React review booking" }],
    mateo: [{ amount: -32, type: "booking_spend", entity: bookings.get("design-mateo")._id, description: "Product critique booking" }],
    emi: [{ amount: -18, type: "booking_spend", entity: bookings.get("italian-emi")._id, description: "Upcoming Italian conversation" }],
    sofia: [{ amount: 18, type: "teaching_reward", entity: bookings.get("italian-emi")._id, description: "Reserved Italian session reward" }],
  };
  for (const persona of personas) {
    const events = [{ amount: 100, type: "bonus", entity: users.get(persona.key)._id, description: "Welcome to the SkillSwap demo marketplace" }, ...(extras[persona.key] || [])];
    let balance = 0; let earned = 0; let spent = 0;
    for (const [index, event] of events.entries()) {
      balance += event.amount; earned += Math.max(0, event.amount); spent += Math.max(0, -event.amount);
      const idempotencyKey = `demo-seed:${persona.key}:${index + 1}`;
      if (!(await CreditTransaction.exists({ idempotencyKey }))) {
        await CreditTransaction.create({ transactionId: `DEMO-${persona.key.toUpperCase()}-${index + 1}`, idempotencyKey, user: users.get(persona.key)._id, amount: event.amount, type: event.type, relatedEntity: { kind: event.type.includes("booking") || event.type === "teaching_reward" ? "booking" : "system", id: event.entity }, description: event.description, balanceAfter: balance });
      }
    }
    await Wallet.findOneAndUpdate({ user: users.get(persona.key)._id }, { $set: { balance, lifetimeEarned: earned, lifetimeSpent: spent, revision: events.length } }, { upsert: true, new: true, runValidators: true });
  }
}

async function seedCommunities(users, skills) {
  const specs = [
    { key: "frontend-craft", name: "Frontend Craft Circle", owner: "aarav", skill: "React", description: "A small community for maintainable frontend systems, accessibility reviews, and honest implementation trade-offs.", members: ["aarav", "maya", "mateo", "samira"], posts: [["aarav", "question", "What makes a useful code-review request?", "Share the smallest reproducible context, what you expected, and the decision you are currently stuck on."], ["maya", "resource", "A critique checklist for loading states", "A short checklist for making async states legible without adding noise.", "https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html"]] },
    { key: "creative-practice", name: "Creative Practice Lab", owner: "nia", skill: "Photography", description: "Photographers, musicians, and creators sharing works in progress and repeatable practice routines.", members: ["nia", "emi", "daniel", "amina"], posts: [["nia", "post", "One-light portrait study", "This week: make three portraits using the same window at different times, then compare direction and contrast rather than gear."]] },
    { key: "founder-learning", name: "Founder Learning Exchange", owner: "jonas", skill: "Startup Strategy", description: "A practical group for founders learning customer discovery, positioning, and sustainable operating habits.", members: ["jonas", "leo", "priya", "rhea"], posts: [["jonas", "question", "Which assumption would change your roadmap?", "Name one customer assumption that would materially change what you build next, and the cheapest credible way to test it."]] },
  ];
  for (const spec of specs) {
    const community = await Community.findOneAndUpdate({ slug: spec.key }, { $set: { name: spec.name, slug: spec.key, description: spec.description, skill: skills.get(spec.skill)._id, category: skills.get(spec.skill).category, owner: users.get(spec.owner)._id, admins: [users.get(spec.owner)._id], moderators: [], visibility: "public", rules: ["Give specific, respectful feedback", "Share work you have permission to share", "No unsolicited promotion"], status: "active", memberCount: spec.members.length, postCount: spec.posts.length } }, { upsert: true, new: true, runValidators: true });
    for (const member of spec.members) await CommunityMembership.findOneAndUpdate({ community: community._id, user: users.get(member)._id }, { $set: { role: member === spec.owner ? "admin" : "member", status: "active", joinedAt: at(-45 + spec.members.indexOf(member) * 4) } }, { upsert: true, new: true, runValidators: true });
    for (const [index, post] of spec.posts.entries()) {
      const [author, type, title, content, resourceUrl = ""] = post;
      await CommunityPost.findOneAndUpdate({ _id: stableId(`community-post:${spec.key}:${index}`) }, { $set: { community: community._id, author: users.get(author)._id, type, title, content, resourceUrl, status: "published", commentCount: 0 } }, { upsert: true, new: true, runValidators: true });
    }
  }
}

async function seedLearning(users, skills) {
  const specs = [
    { key: "samira-data", user: "samira", skill: "Data Analysis", goal: "Build and explain a reproducible analysis of a public mobility dataset", progress: 50, mentor: "priya" },
    { key: "mateo-research", user: "mateo", skill: "UX Research", goal: "Run five useful interviews before scoping the next mobile product", progress: 25, mentor: "priya" },
    { key: "amina-video", user: "amina", skill: "Video Editing", goal: "Publish a restrained three-part interview series with consistent sound and pacing", progress: 75, mentor: "daniel" },
  ];
  for (const spec of specs) {
    const milestoneIds = [0, 1, 2, 3].map((index) => stableId(`roadmap:${spec.key}:milestone:${index}`));
    const completed = Math.round(spec.progress / 25);
    const milestones = ["Define the outcome", "Study a strong example", "Build the first version", "Publish and reflect"].map((title, index) => ({ _id: milestoneIds[index], title, description: `A concrete step toward: ${spec.goal}`, order: index + 1, targetDate: at(14 + index * 21), status: index < completed ? "completed" : index === completed ? "in_progress" : "pending", completedAt: index < completed ? at(-20 + index * 5) : null }));
    const tasks = milestones.flatMap((milestone, index) => [0, 1].map((taskIndex) => ({ _id: stableId(`roadmap:${spec.key}:task:${index}:${taskIndex}`), milestone: milestone._id, title: taskIndex ? `Share evidence for ${milestone.title.toLowerCase()}` : `Complete ${milestone.title.toLowerCase()}`, description: "Keep the evidence small enough to review in one sitting.", order: index * 2 + taskIndex + 1, status: index < completed ? "completed" : "pending", completedAt: index < completed ? at(-20 + index * 5) : null })));
    await Roadmap.findOneAndUpdate({ _id: stableId(`roadmap:${spec.key}`) }, { $set: { user: users.get(spec.user)._id, targetSkill: skills.get(spec.skill)._id, goal: spec.goal, milestones, tasks, mentorRecommendations: [{ user: users.get(spec.mentor)._id, skill: skills.get(spec.skill)._id, skillName: spec.skill, suitabilityScore: 88, reasons: ["Verified related teaching skill", "Strong learner feedback"] }], startDate: at(-30), targetDate: at(90), progress: spec.progress, status: "active", generationSource: "deterministic", generationProvider: "grounded_fallback" } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  }
}

async function seedProjects(users, skills) {
  const specs = [
    ["maya", "clinic-intake-redesign", "Accessible clinic intake redesign", "Lead product designer", ["Product Design", "UX Research"], "Simplified a high-anxiety intake flow after research with patients and clinic staff.", ["Reduced required decisions per screen", "Added keyboard and screen-reader acceptance criteria"]],
    ["nia", "artists-at-work", "Artists at work portrait series", "Photographer", ["Photography", "Photo Editing"], "A documentary portrait series made with independent craftspeople in their own studios.", ["Published twelve environmental portraits", "Used one-light setups in eight locations"]],
    ["aarav", "community-scheduling", "Community scheduling toolkit", "Full-stack engineer", ["React", "Node.js"], "An open scheduling prototype for small volunteer-led learning groups.", ["Modelled timezone-safe availability", "Added conflict-safe reservation tests"]],
  ];
  for (const [owner, slug, title, role, skillNames, description, outcomes] of specs) {
    await Project.findOneAndUpdate({ owner: users.get(owner)._id, title }, { $set: { owner: users.get(owner)._id, title, description, skills: skillNames.map((name) => skills.get(name)._id), role, projectUrl: `https://example.com/projects/${slug}`, repositoryUrl: owner === "aarav" ? `https://github.com/example/${slug}` : "", outcomes, startedAt: at(-180), completedAt: at(-45), featured: true, status: "published", publishedAt: at(-42) } }, { upsert: true, new: true, runValidators: true });
  }
}

async function seedNotifications(users) {
  const specs = [
    ["samira", "booking", "Your React session is complete", "Add a review while the details are still fresh.", "/bookings", true],
    ["mateo", "review", "Maya left feedback", "Your completed product critique now has verified feedback.", "/profile", false],
    ["emi", "booking_reminder", "Italian conversation in four days", "Review your goals and add any vocabulary you want to practise.", "/bookings", false],
    ["aarav", "credits", "28 SkillCredits earned", "Your teaching reward has been added to your wallet.", "/credits", true],
    ["amina", "community", "New discussion in Creative Practice Lab", "Nia shared a one-light portrait study for this week.", "/communities", false],
    ["rhea", "system", "Demo marketplace is ready", "Review moderation, verification, and transaction views with the connected sample records.", "/admin", false],
  ];
  for (const [index, [user, type, title, body, link, read]] of specs.entries()) {
    await Notification.findOneAndUpdate({ user: users.get(user)._id, dedupeKey: `demo-seed:notification:${index}` }, { $set: { type, title, body, link, read, readAt: read ? at(-1) : null, priority: type === "system" ? "high" : "normal", metadata: { demo: true }, dedupeKey: `demo-seed:notification:${index}` } }, { upsert: true, new: true, runValidators: true });
  }
}

async function verifySeed(users) {
  const userIds = [...users.values()].map((user) => user._id);
  const checks = {
    users: await User.countDocuments({ _id: { $in: userIds } }),
    canonicalSkills: await Skill.countDocuments({ slug: { $in: skillCatalog.map((item) => item[1]) } }),
    userSkills: await UserSkill.countDocuments({ user: { $in: userIds } }),
    listings: await Listing.countDocuments({ owner: { $in: userIds }, status: "published" }),
    bookings: await Booking.countDocuments({ $or: [{ teacher: { $in: userIds } }, { student: { $in: userIds } }] }),
    reviews: await Review.countDocuments({ reviewer: { $in: userIds } }),
    availabilityRules: await AvailabilityRule.countDocuments({ user: { $in: userIds } }),
    notifications: await Notification.countDocuments({ user: { $in: userIds }, "metadata.demo": true }),
    transactions: await CreditTransaction.countDocuments({ user: { $in: userIds }, idempotencyKey: /^demo-seed:/ }),
    communities: await Community.countDocuments({ slug: { $in: ["frontend-craft", "creative-practice", "founder-learning"] } }),
    roadmaps: await Roadmap.countDocuments({ user: { $in: userIds } }),
    projects: await Project.countDocuments({ owner: { $in: userIds }, status: "published" }),
  };
  const minimums = { users: 13, canonicalSkills: 27, userSkills: 30, listings: 10, bookings: 5, reviews: 3, availabilityRules: 16, notifications: 6, transactions: 13, communities: 3, roadmaps: 3, projects: 3 };
  for (const [key, minimum] of Object.entries(minimums)) if (checks[key] < minimum) throw new Error(`Seed verification failed: ${key}=${checks[key]}, expected at least ${minimum}`);
  return checks;
}

async function seed() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") throw new Error("Production seeding is disabled. Set ALLOW_PRODUCTION_SEED=true only for an approved demo environment.");
  if (DEMO_PASSWORD.length < 12) throw new Error("SEED_DEMO_PASSWORD must contain at least 12 characters");
  await mongoose.connect(MONGO_URI);
  const users = await upsertUsers();
  const skills = await upsertSkills();
  await seedUserSkills(users, skills);
  const listings = await seedListings(users, skills);
  await seedAvailability(users);
  const bookings = await seedBookings(users, skills, listings);
  await seedReviews(users, bookings);
  await seedWallets(users, bookings);
  await seedCommunities(users, skills);
  await seedLearning(users, skills);
  await seedProjects(users, skills);
  await seedNotifications(users);
  const checks = await verifySeed(users);
  console.log("SkillSwap demo seed verified", checks);
  console.log("Demo accounts use @demo.skillswap.local addresses. Set SEED_DEMO_PASSWORD to choose their password.");
}

seed().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});
