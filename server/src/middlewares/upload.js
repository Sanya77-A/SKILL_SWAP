import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";
import { isVercelRuntime } from "../config/runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const resolveUploadDirectory = ({
  vercel = process.env.VERCEL,
  nodeEnv = env.NODE_ENV,
  temporaryDirectory = os.tmpdir(),
  moduleDirectory = __dirname,
} = {}) => (
  isVercelRuntime(vercel) || nodeEnv === "production"
    ? path.join(temporaryDirectory, "skillswap-uploads")
    : path.join(moduleDirectory, "../../uploads")
);

export const getUploadDirectory = () => resolveUploadDirectory();

export const ensureUploadDirectory = async (directory = getUploadDirectory()) => {
  await fs.promises.mkdir(directory, { recursive: true });
  return directory;
};

const imageTypes = new Map([
  ["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/gif", ".gif"], ["image/webp", ".webp"],
]);
const documentTypes = new Map([
  ["application/pdf", ".pdf"], ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"], ["text/plain", ".txt"],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const directory = getUploadDirectory();
    ensureUploadDirectory(directory).then(() => cb(null, directory), cb);
  },
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${imageTypes.get(file.mimetype) || documentTypes.get(file.mimetype) || ".bin"}`),
});

const extensionMatches = (file, types) => types.get(file.mimetype) === path.extname(file.originalname).toLowerCase().replace(".jpeg", ".jpg");
const profileFilter = (_req, file, cb) => extensionMatches(file, imageTypes) ? cb(null, true) : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only JPEG, PNG, GIF, and WebP images are allowed"));
const chatFileFilter = (_req, file, cb) => extensionMatches(file, imageTypes) || extensionMatches(file, documentTypes)
  ? cb(null, true)
  : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only images, PDF, DOC, DOCX, and TXT files are allowed"));

export const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 }, fileFilter: profileFilter });
export const chatUpload = multer({ storage, limits: { fileSize: MAX_UPLOAD_BYTES, files: 5 }, fileFilter: chatFileFilter }).array("attachments", 5);

const startsWith = (buffer, bytes) => bytes.every((byte, index) => buffer[index] === byte);
const hasValidSignature = (file, buffer) => {
  if (file.mimetype === "image/jpeg") return startsWith(buffer, [0xff, 0xd8, 0xff]);
  if (file.mimetype === "image/png") return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (file.mimetype === "image/gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
  if (file.mimetype === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (file.mimetype === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (file.mimetype === "application/msword") return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
  if (file.mimetype === "text/plain") return !buffer.includes(0) && !buffer.subarray(0, 1024).toString("utf8").includes("\uFFFD");
  return false;
};

export const removeUploadedFiles = (files) => Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));

export const validateUploadedFiles = async (req, res, next) => {
  const files = [...(req.files || []), ...(req.file ? [req.file] : [])];
  try {
    for (const file of files) {
      const handle = await fs.promises.open(file.path, "r");
      const buffer = Buffer.alloc(Math.min(file.size, 4096));
      await handle.read(buffer, 0, buffer.length, 0);
      await handle.close();
      if (!hasValidSignature(file, buffer)) {
        await removeUploadedFiles(files);
        return res.status(400).json({ success: false, message: "Uploaded file content does not match its declared type", error: { code: "INVALID_FILE_CONTENT", message: "Uploaded file content does not match its declared type" } });
      }
    }
    next();
  } catch (error) {
    await removeUploadedFiles(files);
    next(error);
  }
};

export const cleanupUnpersistedChatUploads = (req, res, next) => {
  res.once("finish", () => {
    if (!req.chatUploadsPersisted) removeUploadedFiles(req.files || []);
  });
  next();
};

export const cleanupUnpersistedProfileUpload = (req, res, next) => {
  res.once("finish", () => {
    if (req.file && !req.profileUploadPersisted) removeUploadedFiles([req.file]);
  });
  next();
};
