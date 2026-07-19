import type { RequestHandler } from "express";
import { createSession } from "../services/session.service.js";
import { refreshCookieOptions } from "../config/cookie.js";

// ─── Controllers ──────────────────────────────────────────────────────────────

export const create: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    const result = await createSession(email, password, req);

    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions());

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};
