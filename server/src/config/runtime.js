export const isVercelRuntime = (value = process.env.VERCEL) => {
  if (value == null) return false;
  return !["", "0", "false"].includes(String(value).trim().toLowerCase());
};

export const requiresPersistentUploadStorage = () => (
  isVercelRuntime() || process.env.NODE_ENV === "production"
);
