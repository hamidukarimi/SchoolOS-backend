import { Router } from "express";
import {
  createGrade,
  bulkCreateGrade,
  getAllGrades,
  getGradeById,
  updateGrade,
  deleteGrade,
  getStudentGradeSummary,
} from "../controllers/grade.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/adminOnly.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createGradeSchema,
  updateGradeSchema,
  bulkCreateGradeSchema,
} from "../validators/grade.validator.js";

const router = Router();

router.use(protect);

router.get("/", getAllGrades);
router.get("/summary/:studentId", getStudentGradeSummary);
router.get("/:id", getGradeById);

router.post("/", adminOnly, validate(createGradeSchema), createGrade);
router.post("/bulk", adminOnly, validate(bulkCreateGradeSchema), bulkCreateGrade);
router.put("/:id", adminOnly, validate(updateGradeSchema), updateGrade);
router.delete("/:id", adminOnly, deleteGrade);

export default router;