import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import User from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import {
  accessTokenVerifyOptions,
  type AccessTokenPayload,
} from "../utils/jwt.js";

const protect: RequestHandler = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new ApiError(401, "Not authorized. No token provided.");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new ApiError(401, "Not authorized. No token provided.");
    }

    let decoded: AccessTokenPayload;
    try {
      decoded = jwt.verify(
        token,
        env.jwtAccessSecret,
        accessTokenVerifyOptions(),
      ) as AccessTokenPayload;
    } catch {
      throw new ApiError(401, "Invalid or expired token.");
    }

    if (!decoded.sub || typeof decoded.tokenVersion !== "number") {
      throw new ApiError(401, "Invalid token payload.");
    }

    const user = await User.findById(decoded.sub);

    if (!user) {
      throw new ApiError(401, "User no longer exists.");
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      throw new ApiError(401, "Session is no longer valid. Please sign in again.");
    }

    if (!user.isActive) {
      throw new ApiError(403, "Account is deactivated.");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export default protect;
