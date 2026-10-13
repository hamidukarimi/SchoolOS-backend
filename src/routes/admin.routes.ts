import { Router } from "express";
import type { RequestHandler } from "express";
import * as accountController from "../controllers/account.controller.js";
import protect from "../middlewares/auth.middleware.js";
import authorize from "../middlewares/role.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  accountListQuerySchema,
  createAccountSchema,
  updateAccountSchema,
} from "../validators/account.validator.js";

const router = Router();
const admin = [protect, authorize("admin")] as const;

const adminDashboard: RequestHandler = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome Admin! You can see this dashboard.",
    user: req.user,
  });
};

router.get("/dashboard", protect, authorize("admin"), adminDashboard);
router.get("/users", ...admin, validate(accountListQuerySchema, "query"), accountController.listAccounts);
router.post("/users", ...admin, validate(createAccountSchema), accountController.createAccount);
router.get("/users/:id", ...admin, accountController.getAccount);
router.patch("/users/:id", ...admin, validate(updateAccountSchema), accountController.updateAccount);

export default router;