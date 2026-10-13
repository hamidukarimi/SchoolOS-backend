import { Router } from "express";
import {
  exportAttendanceReport,
  exportClassReport,
  exportEnrollmentReport,
  exportFeeReport,
  exportGradeReport,
  getAttendanceReport,
  getClassReport,
  getEnrollmentReport,
  getFeeReport,
  getGradeReport,
} from "../controllers/report.controller.js";
import protect from "../middlewares/auth.middleware.js";
import loadSchoolReadScope from "../middlewares/schoolReadScope.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  attendanceReportQuerySchema,
  classReportQuerySchema,
  enrollmentReportQuerySchema,
  feeReportQuerySchema,
  gradeReportQuerySchema,
} from "../validators/report.validator.js";

const router = Router();

router.use(protect);
router.use(loadSchoolReadScope);

router.get("/classes", validate(classReportQuerySchema, "query"), getClassReport);
router.get("/classes.csv", validate(classReportQuerySchema, "query"), exportClassReport);
router.get("/enrollment", validate(enrollmentReportQuerySchema, "query"), getEnrollmentReport);
router.get("/enrollment.csv", validate(enrollmentReportQuerySchema, "query"), exportEnrollmentReport);
router.get("/attendance", validate(attendanceReportQuerySchema, "query"), getAttendanceReport);
router.get("/attendance.csv", validate(attendanceReportQuerySchema, "query"), exportAttendanceReport);
router.get("/grades", validate(gradeReportQuerySchema, "query"), getGradeReport);
router.get("/grades.csv", validate(gradeReportQuerySchema, "query"), exportGradeReport);
router.get("/fees", validate(feeReportQuerySchema, "query"), getFeeReport);
router.get("/fees.csv", validate(feeReportQuerySchema, "query"), exportFeeReport);

export default router;
