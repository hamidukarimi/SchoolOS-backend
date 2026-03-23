import { Router } from "express";
import {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  getHRSummary,
} from "../controllers/hr.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/adminOnly.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createStaffSchema,
  updateStaffSchema,
} from "../validators/hr.validator.js";

const router = Router();

router.use(protect);
router.use(adminOnly);

router.get("/", getAllStaff);
router.get("/summary", getHRSummary);
router.get("/:id", getStaffById);

router.post("/", validate(createStaffSchema), createStaff);
router.put("/:id", validate(updateStaffSchema), updateStaff);
router.delete("/:id", deleteStaff);

export default router;