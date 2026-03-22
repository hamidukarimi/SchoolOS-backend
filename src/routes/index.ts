import { Router } from "express";
import userRoutes from "./user.routes.js";
import sessionRoutes from "./session.routes.js";
import refreshRoutes from "./refresh.routes.js";
import logoutRoutes from "./logout.routes.js";

import studentRoutes from "./student.routes.js";
import teacherRoutes from "./teacher.routes.js";
import classRoutes from "./class.routes.js";
import timetableRoutes from "./timetable.routes.js";
import attendanceRoutes from "./attendance.routes.js";


const router = Router();

router.use("/users", userRoutes);
router.use("/sessions", sessionRoutes);
router.use("/token", refreshRoutes);
router.use("/logout", logoutRoutes);


router.use("/students", studentRoutes);
router.use("/teachers", teacherRoutes);
router.use("/classes", classRoutes);
router.use("/timetables", timetableRoutes);
router.use("/attendance", attendanceRoutes);


export default router;
