import rateLimit from "express-rate-limit";
import type { Options } from "express-rate-limit";

const loginRateLimitOptions: Partial<Options> = {
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: {
    success: false,
    message: "Too many login attempts. Try again in 10 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
};

export const loginLimiter = rateLimit(loginRateLimitOptions);

const registerRateLimitOptions: Partial<Options> = {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: "Too many registration attempts. Try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
};

export const registerLimiter = rateLimit(registerRateLimitOptions);

const refreshRateLimitOptions: Partial<Options> = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many refresh requests. Try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
};

export const refreshLimiter = rateLimit(refreshRateLimitOptions);
