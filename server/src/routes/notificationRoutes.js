import { Router } from "express";
import * as notification from "../controllers/notificationController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { listNotificationsSchema, notificationIdSchema, notificationPreferencesSchema } from "../validators/notification.js";

const router = Router();
router.use(protect);
router.get("/", validate(listNotificationsSchema), notification.list);
router.get("/unread-count", notification.unreadCount);
router.get("/preferences", notification.preferences);
router.put("/preferences", validate(notificationPreferencesSchema), notification.savePreferences);
router.patch("/:id/read", validate(notificationIdSchema), notification.markRead);
router.patch("/read-all", notification.markAllRead);
export default router;
