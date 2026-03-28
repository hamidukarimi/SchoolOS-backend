import type { RequestHandler } from "express";
import type { StringValue } from "ms";
import { handleRefreshToken } from "../services/refresh.service.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import ms from "ms";

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const oldRefreshToken = req.cookies.refreshToken as string | undefined;

    if (!oldRefreshToken) {
      throw new ApiError(401, "No refresh token provided.");
    }

    const result = await handleRefreshToken(oldRefreshToken, req);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: ms(env.jwtRefreshExpiresIn as StringValue),
    });

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
