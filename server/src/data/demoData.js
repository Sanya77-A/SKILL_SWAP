const demoNotice = "Demo data is fictional and read-only. Changes are not persisted.";

export const demoUsers = Object.freeze({
  user: {
    _id: "demo-user",
    name: "Avery Chen",
    fullName: "Avery Chen",
    username: "demo_learner",
    email: "demo.user@example.invalid",
    role: "user",
    demoRole: "user",
    isDemo: true,
    headline: "Product designer learning practical data storytelling",
    bio: "A fictional learner profile for exploring SkillSwap without creating an account.",
    location: "Singapore",
    languages: ["English", "Mandarin"],
    skillsOffered: ["Product Design", "Figma"],
    skillsWanted: ["Data Visualization", "Python"],
    ratingAvg: 4.8,
    ratingCount: 12,
    profileCompleteness: 88,
    onboardingCompleted: true,
    status: "active",
  },
  mentor: {
    _id: "demo-mentor-session",
    name: "Maya Thompson",
    fullName: "Maya Thompson",
    username: "demo_mentor",
    email: "demo.mentor@example.invalid",
    role: "mentor",
    demoRole: "mentor",
    isDemo: true,
    headline: "Data visualization mentor and learning facilitator",
    bio: "A fictional mentor identity with a read-only view of the SkillSwap workspace.",
    location: "Toronto, Canada",
    languages: ["English", "French"],
    skillsOffered: ["Data Visualization", "D3.js", "Information Design"],
    skillsWanted: ["Product Strategy"],
    ratingAvg: 4.9,
    ratingCount: 48,
    profileCompleteness: 96,
    onboardingCompleted: true,
    status: "active",
  },
  admin: {
    _id: "demo-admin-session",
    name: "Jordan Brooks",
    fullName: "Jordan Brooks",
    username: "demo_admin_viewer",
    email: "demo.admin@example.invalid",
    role: "demo_admin",
    demoRole: "admin",
    isDemo: true,
    headline: "Read-only operations preview",
    bio: "A fictional demo identity. It has no production administration permissions.",
    location: "London, United Kingdom",
    languages: ["English"],
    skillsOffered: ["Community Operations"],
    skillsWanted: ["Data Visualization"],
    ratingAvg: 0,
    ratingCount: 0,
    profileCompleteness: 82,
    onboardingCompleted: true,
    status: "active",
  },
});

export const demoSkills = Object.freeze([
  { _id: "demo-skill-dataviz", name: "Data Visualization", category: "Technology", description: "Turn complex information into clear, decision-ready visual stories.", isDemo: true },
  { _id: "demo-skill-python", name: "Python", category: "Technology", description: "Build dependable scripts and analysis workflows with Python.", isDemo: true },
  { _id: "demo-skill-figma", name: "Figma", category: "Design", description: "Design accessible product interfaces and reusable systems.", isDemo: true },
  { _id: "demo-skill-storytelling", name: "Storytelling", category: "Communication", description: "Structure ideas so an audience can understand and act on them.", isDemo: true },
]);

export const demoMentors = Object.freeze([
  {
    _id: "demo-mentor-maya", username: "maya_visualizes", fullName: "Maya Thompson", name: "Maya Thompson",
    headline: "Data visualization mentor for product teams", bio: "I help learners turn raw findings into useful visual explanations.",
    location: "Toronto, Canada", languages: ["English", "French"], skillsOffered: ["Data Visualization", "D3.js"],
    availability: ["Tuesday evenings", "Saturday mornings"], ratingAvg: 4.9, ratingCount: 48, skillScore: 94,
    verificationBadges: ["Identity verified", "Skill evidence reviewed"], isDemo: true,
  },
  {
    _id: "demo-mentor-noah", username: "noah_codes", fullName: "Noah Williams", name: "Noah Williams",
    headline: "Patient Python coach for first practical projects", bio: "I teach Python through small tools that solve a real problem.",
    location: "Melbourne, Australia", languages: ["English"], skillsOffered: ["Python", "Automation"],
    availability: ["Weekday mornings"], ratingAvg: 4.8, ratingCount: 36, skillScore: 91,
    verificationBadges: ["Identity verified"], isDemo: true,
  },
  {
    _id: "demo-mentor-priya", username: "priya_frames", fullName: "Priya Nair", name: "Priya Nair",
    headline: "Design systems and accessible Figma workflows", bio: "I help designers create consistent interfaces without losing the human details.",
    location: "Bengaluru, India", languages: ["English", "Hindi", "Malayalam"], skillsOffered: ["Figma", "Design Systems"],
    availability: ["Friday afternoons", "Sunday mornings"], ratingAvg: 4.9, ratingCount: 61, skillScore: 96,
    verificationBadges: ["Identity verified", "Skill evidence reviewed"], isDemo: true,
  },
]);

export const demoListings = Object.freeze([
  {
    _id: "demo-listing-visual-story", title: "Build a clear visual story from messy research", description: "A practical session that turns a small research dataset into a focused narrative and chart plan.",
    skill: demoSkills[0], owner: demoMentors[0], ratingAvg: 4.9, exchangeEnabled: true, creditsEnabled: true, creditCost: 18, paidEnabled: false, currency: "USD", price: 0, isDemo: true,
  },
  {
    _id: "demo-listing-python-first-tool", title: "Ship your first useful Python automation", description: "Choose one repetitive task and leave with a readable script, tests, and next steps.",
    skill: demoSkills[1], owner: demoMentors[1], ratingAvg: 4.8, exchangeEnabled: true, creditsEnabled: true, creditCost: 16, paidEnabled: false, currency: "USD", price: 0, isDemo: true,
  },
  {
    _id: "demo-listing-figma-system", title: "Turn a Figma file into a small design system", description: "Organize tokens, components, and states around an interface you already understand.",
    skill: demoSkills[2], owner: demoMentors[2], ratingAvg: 4.9, exchangeEnabled: true, creditsEnabled: true, creditCost: 20, paidEnabled: false, currency: "USD", price: 0, isDemo: true,
  },
]);

export function demoExploreData(query = {}) {
  const search = String(query.q || "").trim().toLowerCase();
  const category = String(query.category || "").trim().toLowerCase();
  const matches = (values) => !search || values.some((value) => String(value || "").toLowerCase().includes(search));
  const skills = demoSkills.filter((skill) => (!category || skill.category.toLowerCase() === category) && matches([skill.name, skill.description, skill.category]));
  const mentors = demoMentors.filter((mentor) => matches([mentor.fullName, mentor.headline, mentor.bio, ...mentor.skillsOffered]));
  const listings = demoListings.filter((listing) => matches([listing.title, listing.description, listing.skill.name, listing.owner.fullName]));
  return { listings, mentors, skills, pagination: { page: 1, limit: 12, total: listings.length, pages: 1 } };
}

export function demoDashboard(role = "user") {
  const profile = demoUsers[role] || demoUsers.user;
  return {
    demo: true,
    persistence: false,
    notice: demoNotice,
    profile,
    skills: { offered: profile.skillsOffered, wanted: profile.skillsWanted },
    recommendations: demoMentors.slice(0, 2).map((user, index) => ({ user, reasons: index ? ["Matches your Python learning goal", "Available in compatible hours"] : ["Teaches a skill you want", "Highly rated by fictional demo learners"] })),
    nextBooking: {
      _id: "demo-booking-upcoming", skill: demoSkills[0], teacher: demoMentors[0], student: profile,
      startAt: "2030-04-18T15:00:00.000Z", timezone: "UTC", duration: 45, mode: "online", status: "confirmed", isDemo: true,
    },
    wallet: { balance: 120, integrityValid: true, isDemo: true },
    learning: {
      summary: { activeRoadmaps: 1, completedMilestones: 3, totalMilestones: 8 },
      activeSkills: [{ skill: demoSkills[0], progress: 42 }],
      milestones: { upcoming: [{ _id: "demo-milestone", title: "Explain one chart without jargon", progress: 42, isDemo: true }] },
    },
    notification: { _id: "demo-notification", title: "Sample session confirmed", body: "Your fictional Data Visualization session is ready to preview.", link: "/dashboard", read: false, isDemo: true },
    analytics: { profileViews: 34, learningMinutes: 185, skillsPracticed: 2, isDemo: true },
  };
}

export const DEMO_NOTICE = demoNotice;
