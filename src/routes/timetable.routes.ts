import { Router } from "express";
import {
  createTimetable,
  getAllTimetables,
  getTimetableById,
  updateTimetable,
  deleteTimetable,
} from "../controllers/timetable.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/adminOnly.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createTimetableSchema,
  updateTimetableSchema,
} from "../validators/timetable.validator.js";

const router = Router();

router.use(protect);

router.get("/", getAllTimetables);
router.get("/:id", getTimetableById);

router.post("/", adminOnly, validate(createTimetableSchema), createTimetable);
router.put("/:id", adminOnly, validate(updateTimetableSchema), updateTimetable);
router.delete("/:id", adminOnly, deleteTimetable);

export default router;