import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import User from "../models/User.model.js";
import env from "../config/env.js";

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
    const decoded = jwt.verify(token, env.jwtAccessSecret) as JwtPayload;

    if (!decoded.sub) return next();

    const user = await User.findById(decoded.sub);
    if (user) req.user = user;

    next();
  } catch {
    // Invalid or expired token — continue as guest, don't block
    next();
  }
};

export default optionalAuth;