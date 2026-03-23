import { Router } from "express";
import {
  createFee,
  getAllFees,
  getFeeById,
  updateFee,
  deleteFee,
  recordPayment,
  getStudentFeeSummary,
} from "../controllers/fee.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/adminOnly.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createFeeSchema,
  updateFeeSchema,
  recordPaymentSchema,
} from "../validators/fee.validator.js";

const router = Router();

router.use(protect);

router.get("/", getAllFees);
router.get("/summary/:studentId", getStudentFeeSummary);
router.get("/:id", getFeeById);

router.post("/", adminOnly, validate(createFeeSchema), createFee);
router.post("/:id/payment", adminOnly, validate(recordPaymentSchema), recordPayment);
router.put("/:id", adminOnly, validate(updateFeeSchema), updateFee);
router.delete("/:id", adminOnly, deleteFee);

export default router;