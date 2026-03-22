import rateLimit from "express-rate-limit";
import type { Options } from "express-rate-limit";

const rateLimitOptions: Partial<Options> = {
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: {
    success: false,
    message: "Too many login attempts. Try again in 10 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
};

export const loginLimiter = rateLimit(rateLimitOptions);