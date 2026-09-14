import http from "http";
import { Server } from "socket.io";

import app from "./app.js";
import { databaseService } from "./config/db.js";
import { env } from "./config/env.js";
import { allowedOrigins, isAllowedOrigin } from "./config/http.js";
import { setupSocket } from "./socket/index.js";
import { recomputeAllMatchCaches } from "./services/matchService.js";
import { logger } from "./utils/logger.js";
import mongoose from "mongoose";

const PORT = env.PORT;
const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 100_000,
  pingTimeout: 20_000,
  pingInterval: 25_000,
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  },
  path: "/socket.io",
});

const MATCH_CACHE_CRON_MS = 12 * 60 * 60 * 1000;
let matchCronTimer = null;

databaseService.ensureAvailable()
  .then((database) => {
    if (database.persistence) setupSocket(io);
    server.listen(PORT, () => {
      logger.info("server_started", { port: PORT, nodeEnv: env.NODE_ENV, databaseMode: env.DATABASE_MODE });
      logger.info("cors_origins_configured", { originCount: allowedOrigins.length });
      if (database.persistence) {
        matchCronTimer = setInterval(() => {
          recomputeAllMatchCaches().then(() => logger.info("match_cache_recomputed")).catch((error) => logger.error("match_cache_recompute_failed", { error }));
        }, MATCH_CACHE_CRON_MS);
      }
    });
  })
  .catch((error) => {
    logger.error("server_start_failed", { error });
    process.exitCode = 1;
  });

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("server_shutdown_started", { signal });
  if (matchCronTimer) clearInterval(matchCronTimer);
  const forceTimer = setTimeout(() => process.exit(1), 10_000);
  forceTimer.unref();
  server.close(async (error) => {
    if (error) logger.error("server_shutdown_failed", { error });
    await mongoose.connection.close().catch((dbError) => logger.error("database_shutdown_failed", { error: dbError }));
    logger.info("server_shutdown_completed", { signal });
    process.exit(error ? 1 : 0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
