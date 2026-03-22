import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";

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