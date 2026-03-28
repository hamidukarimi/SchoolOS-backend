import jwt from "jsonwebtoken";
import type { SignOptions, JwtPayload, VerifyOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import env from "../config/env.js";

// ─── Issuer / audience (signing and verification must match) ────────────────

export const JWT_ISSUER = "authforge";
export const JWT_AUDIENCE = "authforge-users";

export const accessTokenVerifyOptions = (): VerifyOptions => ({
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
});

export const refreshTokenVerifyOptions = (): VerifyOptions => ({
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
});

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
  tokenVersion: number;
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  tokenVersion: number;
}

// ─── Token generators ─────────────────────────────────────────────────────────

export const generateAccessToken = (user: TokenUser): string => {
  const payload: Omit<AccessTokenPayload, keyof JwtPayload> = {
    role: user.role,
    tokenVersion: user.tokenVersion,
  };

  const options: SignOptions = {
    subject: user._id.toString(),
    expiresIn: env.jwtAccessExpiresIn as StringValue,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
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
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };

  return jwt.sign(payload, env.jwtRefreshSecret, options);
};
