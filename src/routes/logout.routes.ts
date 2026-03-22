import { Router } from "express";
import * as logoutController from "../controllers/logout.controller.js";
import protect from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", logoutController.logout);
router.post("/all", protect, logoutController.logoutAll);

export default router;