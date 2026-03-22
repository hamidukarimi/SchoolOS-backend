import type { Request } from "express";
import type { Types } from "mongoose";
import type { IUserDocument } from "../models/User.model.js";
import Session from "../models/Session.model.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js";
import ApiError from "../utils/ApiError.js";
import crypto from "crypto";
import type { StringValue } from "ms";
import ms from "ms";
import env from "../config/env.js";

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

interface RefreshSessionResult {
  accessToken: string;
  refreshToken: string;
}

// ─── Service Functions ────────────────────────────────────────────────────────

export const handleRefreshToken = async (
  refreshToken: string,
  _req: Request,
): Promise<RefreshSessionResult> => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await Session.findOne({
    refreshTokenHash: hashedToken,
  }).populate<{ user: IUserDocument }>("user");

  if (!session) {
    throw new ApiError(403, "Invalid refresh token");
  }

  if (session.expiresAt < new Date()) {
    await session.deleteOne();
    throw new ApiError(403, "Refresh token expired");
  }

  const user = session.user;

  const newRefreshToken = generateRefreshToken(user);
  const accessToken = generateAccessToken(user);

  session.setRefreshToken(newRefreshToken);
  session.expiresAt = new Date(
    Date.now() + ms(env.jwtRefreshExpiresIn as StringValue),
  );
  await session.save();

  return { accessToken, refreshToken: newRefreshToken };
};

export const revokeAllSessions = async (
  userId: Types.ObjectId,
): Promise<void> => {
  await Session.deleteMany({ user: userId });
};
