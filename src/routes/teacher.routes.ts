import { Router } from "express";
import {
  createTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
} from "../controllers/teacher.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/adminOnly.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createTeacherSchema,
  updateTeacherSchema,
} from "../validators/teacher.validator.js";

const router = Router();

router.use(protect);

router.get("/", getAllTeachers);
router.get("/:id", getTeacherById);

router.post("/", adminOnly, validate(createTeacherSchema), createTeacher);
router.put("/:id", adminOnly, validate(updateTeacherSchema), updateTeacher);
router.delete("/:id", adminOnly, deleteTeacher);

export default router;