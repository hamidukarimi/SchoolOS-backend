import type { RequestHandler } from "express";
import ApiError from "../utils/ApiError.js";

// ─── Admin Only ───────────────────────────────────────────────────────────────
// Must be used AFTER protect middleware — requires req.user to be set

const adminOnly: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  if (req.user.role !== "admin") {
    throw new ApiError(403, "Access denied. Admins only.");
  }

  next();
};

export default adminOnly;