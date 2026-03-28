import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import protect from "../middlewares/auth.middleware.js";
import { registerLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  registerSchema,
  changePasswordSchema,
  updateProfileSchema,
} from "../validators/user.validator.js";

const router = Router();

router.post(
  "/",
  registerLimiter,
  validate(registerSchema),
  userController.create,
);
router.put(
  "/me/password",
  protect,
  validate(changePasswordSchema),
  userController.updatePassword,
);
router.get("/me", protect, userController.getMyProfile);
router.put(
  "/me",
  protect,
  validate(updateProfileSchema),
  userController.updateProfile,
);

export default router;