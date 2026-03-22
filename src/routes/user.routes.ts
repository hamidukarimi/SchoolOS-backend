import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import protect from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  registerSchema,
  changePasswordSchema,
  updateProfileSchema,
} from "../validators/user.validator.js";


const router = Router();

router.post("/", validate(registerSchema), userController.create);
router.put(
  "/me/password",
  protect,
  validate(changePasswordSchema),
  userController.updatePassword,
);

router.get("/me", protect, userController.getMyProfile);

router.get("/me/followed-pages", protect, userController.getFollowedPages);

router.post("/me/saved/:postId", protect, userController.toggleSavePost);
router.get("/me/saved", protect, userController.getSavedPosts);

router.put(
  "/me",
  protect,
  validate(updateProfileSchema),
  userController.updateProfile,
);

export default router;
