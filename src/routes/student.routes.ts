import { Router } from "express";
import {
  createStudent,
  getAllStudents,
  getStudentById,
  getStudentClasses,
  updateStudent,
  deleteStudent,
} from "../controllers/student.controller.js";
import protect from "../middlewares/auth.middleware.js";
import loadSchoolReadScope from "../middlewares/schoolReadScope.middleware.js";
import adminOnly from "../middlewares/adminOnly.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createStudentSchema,
  updateStudentSchema,
} from "../validators/student.validator.js";

const router = Router();

router.use(protect);
router.use(loadSchoolReadScope);

router.get("/", getAllStudents);
router.get("/:id/classes", getStudentClasses);
router.get("/:id", getStudentById);

router.post("/", adminOnly, validate(createStudentSchema), createStudent);
router.put("/:id", adminOnly, validate(updateStudentSchema), updateStudent);
router.delete("/:id", adminOnly, deleteStudent);

export default router;