import { Router } from "express";
import {
  createAttendance,
  bulkCreateAttendance,
  getAllAttendance,
  getAttendanceById,
  updateAttendance,
  deleteAttendance,
  getStudentAttendanceSummary,
} from "../controllers/attendance.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/adminOnly.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createAttendanceSchema,
  updateAttendanceSchema,
  bulkAttendanceSchema,
} from "../validators/attendance.validator.js";

const router = Router();

router.use(protect);

router.get("/", getAllAttendance);
router.get("/:id", getAttendanceById);
router.get("/summary/:studentId", getStudentAttendanceSummary);

router.post("/", adminOnly, validate(createAttendanceSchema), createAttendance);
router.post("/bulk", adminOnly, validate(bulkAttendanceSchema), bulkCreateAttendance);
router.put("/:id", adminOnly, validate(updateAttendanceSchema), updateAttendance);
router.delete("/:id", adminOnly, deleteAttendance);

export default router;