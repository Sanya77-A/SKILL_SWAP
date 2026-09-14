import { DEMO_NOTICE, demoDashboard, demoExploreData, demoListings, demoMentors, demoSkills, demoUsers } from "../data/demoData.js";
import { createDemoSessionToken, demoCookieOptions } from "../middlewares/demoAuth.js";

const allowedRoles = new Set(Object.keys(demoUsers));

export function status(_req, res) {
  res.json({ success: true, data: { enabled: true, mode: "demo", persistence: false, roles: [...allowedRoles], notice: DEMO_NOTICE } });
}

export function login(req, res) {
  const role = String(req.body?.role || "user").toLowerCase();
  if (!allowedRoles.has(role)) {
    return res.status(400).json({ success: false, message: "Choose a valid demo role.", error: { code: "DEMO_ROLE_INVALID", message: "Choose a valid demo role." } });
  }
  res.cookie("demoSession", createDemoSessionToken(role), demoCookieOptions());
  res.json({ success: true, user: demoUsers[role], demo: true, persistence: false, expiresIn: 900, notice: DEMO_NOTICE });
}

export function logout(_req, res) {
  res.cookie("demoSession", "", { ...demoCookieOptions(), maxAge: 0 });
  res.json({ success: true, message: "Demo session ended." });
}

export function me(req, res) {
  res.json({ success: true, user: req.demoUser, demo: true, persistence: false, notice: DEMO_NOTICE });
}

export function dashboard(req, res) {
  res.json({ success: true, data: demoDashboard(req.demoRole) });
}

export function explore(req, res) {
  const result = demoExploreData(req.query);
  res.json({
    success: true,
    data: {
      ...result,
      catalog: demoSkills,
      sections: {
        recommended: demoListings,
        trendingSkills: demoSkills,
        topMentors: demoMentors,
        recentlyActive: demoMentors.slice().reverse(),
        beginnerFriendly: demoListings.slice(0, 2),
        weekendAvailability: demoMentors.filter((mentor) => mentor.availability.some((value) => /Saturday|Sunday/i.test(value))),
        nearby: [],
        freeSkillSwaps: demoListings.filter((listing) => listing.exchangeEnabled),
        creditSessions: demoListings.filter((listing) => listing.creditsEnabled),
        paidMentors: [],
      },
      demo: true,
      persistence: false,
      notice: DEMO_NOTICE,
    },
  });
}

export function mentor(req, res) {
  const selected = demoMentors.find((item) => item._id === req.params.id);
  if (!selected) return res.status(404).json({ success: false, message: "Demo mentor not found.", error: { code: "DEMO_MENTOR_NOT_FOUND", message: "Demo mentor not found." } });
  const listings = demoListings.filter((listing) => listing.owner._id === selected._id);
  return res.json({ success: true, data: { mentor: selected, listings, demo: true, persistence: false, notice: DEMO_NOTICE } });
}
