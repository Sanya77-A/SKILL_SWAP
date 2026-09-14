const asPlainObject = (user) => (typeof user?.toObject === "function" ? user.toObject() : { ...user });

export function serializePublicUser(user, computed = {}) {
  const value = asPlainObject(user);
  const locationVisibility = value.locationVisibility;
  const canSeeLocation = Boolean(computed.isOwner) || locationVisibility === "public" || (locationVisibility === "members" && computed.viewerAuthenticated);
  return {
    _id: value._id,
    fullName: value.fullName || value.name,
    name: value.fullName || value.name,
    username: value.username,
    profilePhoto: value.profilePhoto || value.profileImage,
    profileImage: value.profilePhoto || value.profileImage,
    coverImage: value.coverImage,
    headline: value.headline,
    bio: value.bio,
    occupation: value.occupation,
    company: value.company,
    university: value.university,
    location: canSeeLocation ? value.location : undefined,
    timezone: value.timezone,
    languages: value.languages || [],
    website: value.website,
    github: value.github,
    linkedin: value.linkedin,
    portfolioLinks: value.portfolioLinks || [],
    availability: value.availability || [],
    visibility: value.profileVisibility || value.visibility,
    profileVisibility: value.profileVisibility || value.visibility,
    preferredLearningMode: value.preferredLearningMode,
    preferredTeachingMode: value.preferredTeachingMode,
    preferredLearningModes: value.preferredLearningModes || [],
    preferredTeachingModes: value.preferredTeachingModes || [],
    learningGoals: value.learningGoals || [],
    experienceLevel: value.experienceLevel,
    skillsOffered: value.skillsOffered || [],
    skillsWanted: value.skillsWanted || [],
    ratingAvg: value.ratingAvg || 0,
    ratingCount: value.ratingCount || 0,
    reputation: value.reputation || {},
    sessionsCompleted: computed.sessionsCompleted ?? value.sessionsCompleted ?? 0,
    responseTimeMinutes: value.responseTimeMinutes,
    verificationBadges: value.verificationBadges || [],
    achievements: value.achievements || [],
    skillScore: computed.skillScore ?? value.skillScore ?? 0,
    profileCompleteness: value.profileCompleteness || 0,
    lastActive: computed.isOwner || value.showLastActive === true ? value.lastActive || value.lastActiveAt : undefined,
    role: value.role,
    createdAt: value.createdAt,
  };
}

export function serializePrivateUser(user, computed = {}) {
  const value = asPlainObject(user);
  return {
    ...serializePublicUser(value, { ...computed, isOwner: true, viewerAuthenticated: true }),
    email: value.email,
    emailVerified: Boolean(value.emailVerified),
    onboardingCompleted: Boolean(value.onboardingCompleted),
    preferredExchangeModels: value.preferredExchangeModels || ["exchange"],
    maxCreditCost: value.maxCreditCost,
    maxSessionPrice: value.maxSessionPrice,
    preferredCurrency: value.preferredCurrency || "USD",
    locationVisibility: value.locationVisibility || "public",
    showOnlineStatus: value.showOnlineStatus !== false,
    showLastActive: value.showLastActive !== false,
    messagePermissions: value.messagePermissions || "matches",
    accessibilityPreferences: value.accessibilityPreferences || { reducedMotion: false, highContrast: false },
    status: value.status,
    updatedAt: value.updatedAt,
  };
}
