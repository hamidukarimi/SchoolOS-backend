import { Router } from "express";
import * as refreshController from "../controllers/refresh.controller.js";

const router = Router();

router.post("/", refreshController.refresh);

export default router;