import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import path from "path";
import { fileURLToPath } from "url";

import { apiRouter } from "./routes/index.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { initCloudinary } from "./config/cloudinary.js";
import { env } from "./config/env.js";
import { allowedOrigins, isAllowedOrigin } from "./config/http.js";
import { verifyRequestOrigin } from "./middlewares/csrf.js";
import { apiLimiter } from "./middlewares/rateLimits.js";
import { requestContext } from "./middlewares/requestLogger.js";
import { logger } from "./utils/logger.js";
import { isVercelRuntime } from "./config/runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.set("trust proxy", 1);

initCloudinary();

app.use(helmet());
app.use(compression());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        logger.warn("cors_request_blocked", { origin });
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);
app.use(requestContext);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use(verifyRequestOrigin);
app.use(mongoSanitize());
app.use(xss());

if (env.NODE_ENV !== "production" && !isVercelRuntime()) {
  app.use("/uploads", express.static(path.join(__dirname, "../uploads"), {
    immutable: true,
    maxAge: "1y",
    setHeaders: (res, filePath) => {
      if (/\.(pdf|docx?|txt)$/i.test(filePath)) res.setHeader("Content-Disposition", "attachment");
    },
  }));
}

app.use("/api/v1", apiLimiter, apiRouter);
app.use("/api", apiLimiter, apiRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
