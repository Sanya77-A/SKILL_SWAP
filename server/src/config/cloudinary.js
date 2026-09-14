import { v2 as cloudinary } from "cloudinary";

/**
 * Configure Cloudinary for image uploads
 */
export const isCloudinaryConfigured = (source = process.env) => [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
].every((key) => Boolean(source[key]?.trim()));

export const initCloudinary = () => {
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    return true;
  }
  return false;
};

export { cloudinary };
