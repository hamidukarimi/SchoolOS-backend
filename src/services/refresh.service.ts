import type { Types } from "mongoose";
import jwt from "jsonwebtoken";
import type { IUserDocument } from "../models/User.model.js";
import Session from "../models/Session.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
  refreshTokenVerifyOptions,
  type RefreshTokenPayload,
} from "../utils/jwt.js";
import ApiError from "../utils/ApiError.js";
import crypto from "crypto";
import type { StringValue } from "ms";
import ms from "ms";
import env from "../config/env.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RefreshSessionResult {
  accessToken: string;
  refreshToken: string;
  user: IUserDocument;
}

// ─── Service Functions ────────────────────────────────────────────────────────

export const handleRefreshToken = async (
  refreshToken: string,
): Promise<RefreshSessionResult> => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await Session.findOne({
    refreshTokenHash: hashedToken,
  }).populate<{ user: IUserDocument | null }>("user");

  if (!session) {
    throw new ApiError(403, "Invalid refresh token");
  }

  if (session.expiresAt < new Date()) {
    await session.deleteOne();
    throw new ApiError(403, "Refresh token expired");
  }

  const user = session.user;

  if (!user) {
    await session.deleteOne();
    throw new ApiError(403, "Invalid refresh token");
  }

  if (!user.isActive || user.isBlocked) {
    await session.deleteOne();
    throw new ApiError(403, "Account is unavailable");
  }

  let decoded: RefreshTokenPayload;
  try {
    decoded = jwt.verify(
      refreshToken,
      env.jwtRefreshSecret,
      refreshTokenVerifyOptions(),
    ) as RefreshTokenPayload;
  } catch {
    throw new ApiError(403, "Invalid refresh token");
  }

  if (
    !decoded.sub ||
    typeof decoded.tokenVersion !== "number" ||
    decoded.sub !== user._id.toString() ||
    decoded.tokenVersion !== user.tokenVersion
  ) {
    throw new ApiError(403, "Invalid refresh token");
  }

  const newRefreshToken = generateRefreshToken(user);
  const accessToken = generateAccessToken(user);

  session.setRefreshToken(newRefreshToken);
  session.expiresAt = new Date(
    Date.now() + ms(env.jwtRefreshExpiresIn as StringValue),
  );
  await session.save();

  return { accessToken, refreshToken: newRefreshToken, user };
};

export const revokeAllSessions = async (
  userId: Types.ObjectId,
): Promise<void> => {
  await Session.deleteMany({ user: userId });
};
