import type { RequestHandler } from "express";
import Session from "../models/Session.model.js";
import ApiError from "../utils/ApiError.js";
import crypto from "crypto";

// ─── Controllers ──────────────────────────────────────────────────────────────

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken as string | undefined;

    if (refreshToken) {
      const hashedToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      await Session.findOneAndDelete({ refreshTokenHash: hashedToken });
      res.clearCookie("refreshToken");
    }

    res.status(200).json({ success: true, message: "Logged out" });
  } catch (err) {
    next(err);
  }
};

export const logoutAll: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }

    await Session.deleteMany({ user: req.user._id });
    res.clearCookie("refreshToken");

    res.status(200).json({ success: true, message: "Logged out from all devices" });
  } catch (err) {
    next(err);
  }
};