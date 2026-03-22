import { Router } from "express";
import type { RequestHandler } from "express";
import protect from "../middlewares/auth.middleware.js";
import authorize from "../middlewares/role.middleware.js";

const router = Router();

const adminDashboard: RequestHandler = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome Admin! You can see this dashboard.",
    user: req.user,
  });
};

router.get("/admin-dashboard", protect, authorize("admin"), adminDashboard);

export default router;