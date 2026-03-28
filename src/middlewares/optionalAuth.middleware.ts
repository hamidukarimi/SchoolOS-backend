import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import env from "../config/env.js";
import {
  accessTokenVerifyOptions,
  type AccessTokenPayload,
} from "../utils/jwt.js";

// ─── Optional Auth ────────────────────────────────────────────────────────────
// Attaches req.user if a valid token is present, but never blocks the request

const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return next(); // no token — continue as guest
    }

    const token = authHeader.split(" ")[1];
    if (!token) return next();

    let decoded: AccessTokenPayload;
    try {
      decoded = jwt.verify(
        token,
        env.jwtAccessSecret,
        accessTokenVerifyOptions(),
      ) as AccessTokenPayload;
    } catch {
      return next();
    }

    if (!decoded.sub || typeof decoded.tokenVersion !== "number") {
      return next();
    }

    const user = await User.findById(decoded.sub);
    if (user && user.tokenVersion === decoded.tokenVersion) {
      req.user = user;
    }

    next();
  } catch {
    next();
  }
};

export default optionalAuth;
