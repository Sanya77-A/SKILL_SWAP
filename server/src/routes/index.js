import { Router } from "express";
import { env } from "../config/env.js";
import { databaseService } from "../services/databaseService.js";
import demoRoutes from "./demoRoutes.js";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import matchRoutes from "./matchRoutes.js";
import requestRoutes from "./requestRoutes.js";
import chatRoutes from "./chatRoutes.js";
import reviewRoutes from "./reviewRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import adminRoutes from "./adminRoutes.js";
import sessionRoutes from "./sessionRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
import reportRoutes from "./reportRoutes.js";
import skillRoutes from "./skillRoutes.js";
import userSkillRoutes from "./userSkillRoutes.js";
import listingRoutes from "./listingRoutes.js";
import exploreRoutes from "./exploreRoutes.js";
import proposalRoutes from "./proposalRoutes.js";
import bookingRoutes from "./bookingRoutes.js";
import creditRoutes from "./creditRoutes.js";
import assistantRoutes from "./assistantRoutes.js";
import careerPathRoutes from "./careerPathRoutes.js";
import skillGapRoutes from "./skillGapRoutes.js";
import roadmapRoutes from "./roadmapRoutes.js";
import learningRoutes from "./learningRoutes.js";
import communityRoutes from "./communityRoutes.js";
import groupSessionRoutes from "./groupSessionRoutes.js";
import challengeRoutes from "./challengeRoutes.js";
import certificateRoutes from "./certificateRoutes.js";
import projectRoutes from "./projectRoutes.js";
import activityRoutes from "./activityRoutes.js";
import safetyRoutes from "./safetyRoutes.js";
import settingsRoutes from "./settingsRoutes.js";
import { recomputeMatchCaches } from "../controllers/jobController.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  const database = databaseService.state();
  res.json({
    success: true,
    data: {
      status: database.available ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      database: database.database,
      databaseMode: database.mode,
      persistence: database.persistence,
    },
    message: "OK",
  });
});
apiRouter.use("/demo", demoRoutes);
apiRouter.use((req, res, next) => {
  if (env.DATABASE_MODE !== "demo") return next();
  return res.status(503).json({
    success: false,
    message: "Persistent accounts and changes require a configured production database.",
    error: { code: "PERSISTENCE_UNAVAILABLE", message: "Persistent accounts and changes require a configured production database." },
  });
});

apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/matches", matchRoutes);
apiRouter.use("/requests", requestRoutes);
apiRouter.use("/chats", chatRoutes);
apiRouter.use("/reviews", reviewRoutes);
apiRouter.use("/notifications", notificationRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/sessions", sessionRoutes);
apiRouter.use("/analytics", analyticsRoutes);
apiRouter.use("/reports", reportRoutes);
apiRouter.use("/skills", skillRoutes);
apiRouter.use("/user-skills", userSkillRoutes);
apiRouter.use("/listings", listingRoutes);
apiRouter.use("/explore", exploreRoutes);
apiRouter.use("/proposals", proposalRoutes);
apiRouter.use("/bookings", bookingRoutes);
apiRouter.use("/credits", creditRoutes);
apiRouter.use("/assistant", assistantRoutes);
apiRouter.use("/career-paths", careerPathRoutes);
apiRouter.use("/skill-gaps", skillGapRoutes);
apiRouter.use("/roadmaps", roadmapRoutes);
apiRouter.use("/learning", learningRoutes);
apiRouter.use("/communities", communityRoutes);
apiRouter.use("/group-sessions", groupSessionRoutes);
apiRouter.use("/challenges", challengeRoutes);
apiRouter.use("/certificates", certificateRoutes);
apiRouter.use("/projects", projectRoutes);
apiRouter.use("/feed", activityRoutes);
apiRouter.use("/safety", safetyRoutes);
apiRouter.use("/settings", settingsRoutes);
apiRouter.get("/internal/jobs/match-cache", recomputeMatchCaches);
