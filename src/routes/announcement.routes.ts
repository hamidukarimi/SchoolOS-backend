import { Router } from "express";
import {
  createAnnouncement,
  getAllAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcement.controller.js";
import protect from "../middlewares/auth.middleware.js";
import loadSchoolReadScope from "../middlewares/schoolReadScope.middleware.js";
import adminOnly from "../middlewares/adminOnly.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  announcementIdParamsSchema,
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
  updateAnnouncementSchema,
} from "../validators/announcement.validator.js";

const router = Router();

router.use(protect);
router.use(loadSchoolReadScope);

router.get("/", validate(listAnnouncementsQuerySchema, "query"), getAllAnnouncements);
router.get("/:id", validate(announcementIdParamsSchema, "params"), getAnnouncementById);

router.post("/", adminOnly, validate(createAnnouncementSchema), createAnnouncement);
router.put(
  "/:id",
  adminOnly,
  validate(announcementIdParamsSchema, "params"),
  validate(updateAnnouncementSchema),
  updateAnnouncement,
);
router.delete("/:id", adminOnly, validate(announcementIdParamsSchema, "params"), deleteAnnouncement);

export default router;