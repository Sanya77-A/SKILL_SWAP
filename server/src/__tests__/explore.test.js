import request from "supertest";
import mongoose from "mongoose";
import app from "../app.js";
import Listing from "../models/Listing.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import UserSkill from "../models/UserSkill.js";

const TEST_URI = process.env.MONGO_URI || "mongodb://localhost:27017/skillswap_test";

describe("Marketplace explore and filters", () => {
  const marker = `${Date.now()}`;
  let mentor;
  let privateMentor;
  let skill;
  let listing;

  beforeAll(async () => {
    await mongoose.connect(TEST_URI);
    mentor = await User.create({
      name: `Explore Mentor ${marker}`,
      username: `explore_${marker}`.slice(0, 30),
      email: `test-explore-${marker}@test.com`,
      password: "password123",
      headline: "Architecture mentor",
      location: "Pune",
      languages: ["English", "Hindi"],
      availability: ["weekends"],
      experienceLevel: "advanced",
      ratingAvg: 4.8,
      ratingCount: 12,
      visibility: "public",
      profileVisibility: "public",
    });
    privateMentor = await User.create({
      name: `Private Explore ${marker}`,
      username: `private_${marker}`.slice(0, 30),
      email: `test-explore-private-${marker}@test.com`,
      password: "password123",
      ratingAvg: 5,
      visibility: "private",
      profileVisibility: "private",
    });
    skill = await Skill.create({ name: `Distributed Systems ${marker}`, slug: `distributed-systems-${marker}`, category: "Technology", popularityScore: 90 });
    await UserSkill.create({ user: mentor._id, skill: skill._id, type: "teach", proficiency: "Advanced", verificationStatus: "verified" });
    listing = await Listing.create({
      owner: mentor._id,
      skill: skill._id,
      slug: `explore-listing-${marker}`,
      title: `Distributed systems coaching ${marker}`,
      description: "Learn practical distributed systems design through real architecture tradeoffs.",
      learningOutcomes: ["Reason about consistency"],
      experienceLevel: "beginner",
      deliveryMode: ["video"],
      sessionDurations: [60],
      exchangeEnabled: true,
      creditsEnabled: true,
      creditCost: 40,
      status: "published",
      publishedAt: new Date(),
    });
  });

  afterAll(async () => {
    await Listing.deleteMany({ _id: listing?._id });
    await UserSkill.deleteMany({ user: { $in: [mentor?._id, privateMentor?._id] } });
    await Skill.deleteMany({ _id: skill?._id });
    await User.deleteMany({ _id: { $in: [mentor?._id, privateMentor?._id] } });
    await mongoose.disconnect();
  });

  test("search combines matching listings, skills, and public mentors", async () => {
    const response = await request(app)
      .get("/api/explore/search")
      .query({ q: marker, sort: "highest_rated", page: 1, limit: 10 })
      .expect(200);
    expect(response.body.data.listings.some((item) => item._id === listing._id.toString())).toBe(true);
    expect(response.body.data.skills.some((item) => item._id === skill._id.toString())).toBe(true);
    expect(response.body.data.mentors.some((item) => item._id === mentor._id.toString())).toBe(true);
    expect(response.body.data.mentors.some((item) => item._id === privateMentor._id.toString())).toBe(false);
  });

  test("compound marketplace filters are applied server-side", async () => {
    const response = await request(app)
      .get("/api/explore/search")
      .query({
        skillId: skill._id.toString(), ratingMin: 4, proficiency: "Advanced", deliveryMode: "online",
        language: "English", location: "Pune", availability: "weekend", verification: "true",
        experienceLevel: "beginner", exchangeOnly: "true", creditsOnly: "true", creditMax: 50,
      })
      .expect(200);
    expect(response.body.data.listings).toHaveLength(1);
    expect(response.body.data.listings[0]._id).toBe(listing._id.toString());

    await request(app).get("/api/explore/search").query({ priceMin: 100, priceMax: 10 }).expect(400);
  });

  test("explore sections expose the required curated collections", async () => {
    const response = await request(app).get("/api/explore").expect(200);
    expect(response.body.data).toHaveProperty("recommended");
    expect(response.body.data).toHaveProperty("trendingSkills");
    expect(response.body.data).toHaveProperty("topMentors");
    expect(response.body.data).toHaveProperty("recentlyActive");
    expect(response.body.data).toHaveProperty("beginnerFriendly");
    expect(response.body.data).toHaveProperty("weekendAvailability");
    expect(response.body.data).toHaveProperty("nearby");
    expect(response.body.data).toHaveProperty("freeSkillSwaps");
    expect(response.body.data).toHaveProperty("creditSessions");
    expect(response.body.data).toHaveProperty("paidMentors");
  });
});
