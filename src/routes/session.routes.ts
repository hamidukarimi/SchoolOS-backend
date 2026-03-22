import { Router } from "express";
import * as sessionController from "../controllers/session.controller.js";
import { loginLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { loginSchema } from "../validators/session.validator.js";

const router = Router();

router.post("/", loginLimiter, validate(loginSchema), sessionController.create);

export default router;