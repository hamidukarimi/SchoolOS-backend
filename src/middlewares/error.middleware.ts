import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";

const isDuplicateKeyError = (
  error: unknown,
): error is { code: number } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const errorMiddleware: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(err);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(env.nodeEnv === "development" && { stack: err.stack }),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.issues.map((issue) => issue.message),
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      message: `Invalid value for ${err.path}`,
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      success: false,
      message: "Database validation error",
      errors: Object.values(err.errors).map((error) => error.message),
    });
    return;
  }

  if (isDuplicateKeyError(err)) {
    res.status(409).json({
      success: false,
      message: "A record with the same unique value already exists",
    });
    return;
  }

  // Unknown/unexpected error
  const message =
    err instanceof Error ? err.message : "Internal Server Error";

  res.status(500).json({
    success: false,
    message: env.nodeEnv === "development" ? message : "Internal Server Error",
    ...(env.nodeEnv === "development" &&
      err instanceof Error && { stack: err.stack }),
  });
};

export default errorMiddleware;
