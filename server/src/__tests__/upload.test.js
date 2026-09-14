import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { jest } from "@jest/globals";

describe("serverless-safe upload staging", () => {
  test("Cloudinary is enabled only when all three credentials are present", async () => {
    const { isCloudinaryConfigured } = await import("../config/cloudinary.js");
    expect(isCloudinaryConfigured({})).toBe(false);
    expect(isCloudinaryConfigured({ CLOUDINARY_CLOUD_NAME: "cloud", CLOUDINARY_API_KEY: "key" })).toBe(false);
    expect(isCloudinaryConfigured({
      CLOUDINARY_CLOUD_NAME: "cloud",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    })).toBe(true);
  });

  test("importing Express in a Vercel-like runtime does not create an upload directory", async () => {
    const originalVercel = process.env.VERCEL;
    process.env.VERCEL = "1";
    const mkdirSync = jest.spyOn(fs, "mkdirSync");
    try {
      const { default: app } = await import(`../app.js?upload-import=${Date.now()}`);
      expect(mkdirSync).not.toHaveBeenCalled();
      await request(app).get("/api/health").expect(200);
      await request(app).post("/api/auth/login").send({}).expect(400);
      await request(app).post("/api/auth/register").send({}).expect(400);
      await request(app).get("/api/users/me").expect(401);
    } finally {
      mkdirSync.mockRestore();
      if (originalVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = originalVercel;
    }
  });

  test("Vercel staging always resolves beneath the writable temporary directory", async () => {
    const { resolveUploadDirectory } = await import("../middlewares/upload.js");
    expect(resolveUploadDirectory({
      vercel: "1",
      nodeEnv: "development",
      temporaryDirectory: "/tmp",
      moduleDirectory: "/var/task/server/src/middlewares",
    })).toBe("/tmp/skillswap-uploads");
  });

  test("production uses transient storage and local development uses server/uploads", async () => {
    const { MAX_UPLOAD_BYTES, resolveUploadDirectory } = await import("../middlewares/upload.js");
    const moduleDirectory = path.join(path.sep, "workspace", "server", "src", "middlewares");
    expect(resolveUploadDirectory({
      vercel: "",
      nodeEnv: "production",
      temporaryDirectory: "/tmp",
      moduleDirectory,
    })).toBe("/tmp/skillswap-uploads");
    expect(resolveUploadDirectory({
      vercel: "",
      nodeEnv: "development",
      temporaryDirectory: "/tmp",
      moduleDirectory,
    })).toBe(path.join(path.sep, "workspace", "server", "uploads"));
    expect(MAX_UPLOAD_BYTES).toBe(4 * 1024 * 1024);
  });

  test("Multer stages on demand and cleanup removes the transient file", async () => {
    const originalVercel = process.env.VERCEL;
    process.env.VERCEL = "1";
    let stagedPath;
    try {
      const [{ default: express }, { removeUploadedFiles, upload }] = await Promise.all([
        import("express"),
        import("../middlewares/upload.js"),
      ]);
      const uploadApp = express();
      uploadApp.post("/", upload.single("profileImage"), (req, res) => {
        stagedPath = req.file.path;
        res.sendStatus(204);
      });
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await request(uploadApp)
        .post("/")
        .attach("profileImage", png, { filename: "avatar.png", contentType: "image/png" })
        .expect(204);
      expect(path.dirname(stagedPath)).toBe(path.join(os.tmpdir(), "skillswap-uploads"));
      await removeUploadedFiles([{ path: stagedPath }]);
      await expect(fs.promises.access(stagedPath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      if (stagedPath) await fs.promises.unlink(stagedPath).catch(() => {});
      if (originalVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = originalVercel;
    }
  });

  test("creates staging lazily and removes transient files", async () => {
    const { ensureUploadDirectory, removeUploadedFiles } = await import("../middlewares/upload.js");
    const parent = await fs.promises.mkdtemp(path.join(os.tmpdir(), "skillswap-upload-test-"));
    const staging = path.join(parent, "nested", "staging");
    const filePath = path.join(staging, "upload.txt");
    try {
      await ensureUploadDirectory(staging);
      await fs.promises.writeFile(filePath, "temporary upload");
      await removeUploadedFiles([{ path: filePath }]);
      await expect(fs.promises.access(filePath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await fs.promises.rm(parent, { recursive: true, force: true });
    }
  });
});
