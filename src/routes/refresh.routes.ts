import { Router } from "express";
import * as refreshController from "../controllers/refresh.controller.js";
import { refreshLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.post("/", refreshLimiter, refreshController.refresh);

export default router;