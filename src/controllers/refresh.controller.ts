import type { RequestHandler } from "express";
import type { StringValue } from "ms";
import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import { handleRefreshToken } from "../services/refresh.service.js";
import User from "../models/User.model.js";
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

    // Decode token to get user id
    const decoded = jwt.verify(
      result.accessToken,
      env.jwtAccessSecret
    ) as JwtPayload;

    const user = await User.findById(decoded.sub);

    if (!user) {
      throw new ApiError(401, "User not found.");
    }

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully.",
      data: {
        accessToken: result.accessToken,
        user,
      },
    });
  } catch (err) {
    next(err);
  }
};