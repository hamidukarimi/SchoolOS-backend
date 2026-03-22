import { Router } from "express";
import userRoutes from "./user.routes.js";
import sessionRoutes from "./session.routes.js";
import refreshRoutes from "./refresh.routes.js";
import logoutRoutes from "./logout.routes.js";
import pageRoutes from "./page.routes.js";
import postRouter from "./post.routes.js";
import notificationRouter from "./notification.routes.js";
import feedRouter from "./feed.routes.js";

const router = Router();

router.use("/users", userRoutes);
router.use("/sessions", sessionRoutes);
router.use("/token", refreshRoutes);
router.use("/logout", logoutRoutes);
router.use("/pages", pageRoutes);
router.use("/posts", postRouter);
router.use("/notifications", notificationRouter);
router.use("/feed", feedRouter);

export default router;
