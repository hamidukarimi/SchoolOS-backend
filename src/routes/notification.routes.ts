import { Router } from "express";
import protect from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  getMyNotifications,
  getNotification,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  removeNotification,
} from "../controllers/notification.controller.js";
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
} from "../validators/notification.validator.js";

const router = Router();

router.use(protect);

router.get("/", validate(listNotificationsQuerySchema, "query"), getMyNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllNotificationsRead);
router.get("/:id", validate(notificationIdParamsSchema, "params"), getNotification);
router.patch("/:id/read", validate(notificationIdParamsSchema, "params"), markNotificationRead);
router.delete("/:id", validate(notificationIdParamsSchema, "params"), removeNotification);

export default router;
