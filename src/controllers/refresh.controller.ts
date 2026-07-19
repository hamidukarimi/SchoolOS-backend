import type { RequestHandler } from "express";
import { handleRefreshToken } from "../services/refresh.service.js";
import ApiError from "../utils/ApiError.js";
import { refreshCookieOptions } from "../config/cookie.js";

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const oldRefreshToken = req.cookies.refreshToken as string | undefined;

    if (!oldRefreshToken) {
      throw new ApiError(401, "No refresh token provided.");
    }

    const result = await handleRefreshToken(oldRefreshToken);

    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions());

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully.",
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
};
