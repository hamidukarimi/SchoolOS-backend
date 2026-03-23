import { Router } from "express";
import {
  createAnnouncement,
  getAllAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcement.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/adminOnly.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "../validators/announcement.validator.js";

const router = Router();

router.use(protect);

router.get("/", getAllAnnouncements);
router.get("/:id", getAnnouncementById);

router.post("/", adminOnly, validate(createAnnouncementSchema), createAnnouncement);
router.put("/:id", adminOnly, validate(updateAnnouncementSchema), updateAnnouncement);
router.delete("/:id", adminOnly, deleteAnnouncement);

export default router;