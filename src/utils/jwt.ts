import jwt from "jsonwebtoken";
import type { SignOptions, JwtPayload } from "jsonwebtoken";
import type { StringValue } from "ms";
import env from "../config/env.js";

// ─── User shape required for token generation ────────────────────────────────

interface TokenUser {
  _id: { toString(): string };
  role: string;
  tokenVersion: number;
}

// ─── Payload shapes ───────────────────────────────────────────────────────────

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  tokenVersion: number;
}

// ─── Token generators ─────────────────────────────────────────────────────────

export const generateAccessToken = (user: TokenUser): string => {
  const payload: Omit<AccessTokenPayload, keyof JwtPayload> = {
    role: user.role,
  };

  const options: SignOptions = {
    subject: user._id.toString(),
    expiresIn: env.jwtAccessExpiresIn as StringValue,
    issuer: "authforge",
    audience: "authforge-users",
  };

  return jwt.sign(payload, env.jwtAccessSecret, options);
};

export const generateRefreshToken = (user: TokenUser): string => {
  const payload: Omit<RefreshTokenPayload, keyof JwtPayload> = {
    tokenVersion: user.tokenVersion,
  };

  const options: SignOptions = {
    subject: user._id.toString(),
    expiresIn: env.jwtRefreshExpiresIn as StringValue,
    issuer: "authforge",
    audience: "authforge-users",
  };

  return jwt.sign(payload, env.jwtRefreshSecret, options);
};