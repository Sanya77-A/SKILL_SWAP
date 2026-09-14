/**
 * Restrict access to admin only
 */
export const adminOnly = (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
};

export const rolePermissions = Object.freeze({
  user: [],
  mentor: [],
  moderator: ["users:read", "content:read", "content:moderate", "moderation:read", "moderation:write", "sessions:read", "verification:read", "verification:write"],
  admin: ["users:read", "users:write", "catalog:read", "catalog:write", "content:read", "content:moderate", "moderation:read", "moderation:write", "sessions:read", "transactions:read", "verification:read", "verification:write", "analytics:read"],
  super_admin: ["users:read", "users:write", "roles:write", "catalog:read", "catalog:write", "content:read", "content:moderate", "moderation:read", "moderation:write", "sessions:read", "transactions:read", "verification:read", "verification:write", "analytics:read"],
});

export const permissionsFor = (role) => rolePermissions[role] || [];

export const requirePermission = (permission) => (req, res, next) => {
  if (!permissionsFor(req.user?.role).includes(permission)) {
    return res.status(403).json({ success: false, message: "You do not have permission for this admin area" });
  }
  next();
};
