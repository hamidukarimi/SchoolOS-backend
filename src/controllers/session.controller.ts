import type { RequestHandler } from "express";
import type { StringValue } from "ms";
import { createSession } from "../services/session.service.js";
import env from "../config/env.js";
import ms from "ms";

// ─── Controllers ──────────────────────────────────────────────────────────────

export const create: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    const result = await createSession(email, password, req);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: ms(env.jwtRefreshExpiresIn as StringValue),
    });

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