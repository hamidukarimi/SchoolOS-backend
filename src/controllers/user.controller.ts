import type { RequestHandler } from "express";
import type { StringValue } from "ms";
import { createUser, changePassword, getMyProfileService, searchUserDirectory, updateProfileService } from "../services/user.service.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import ms from "ms";
import { updateProfileSchema } from "../validators/user.validator.js";

export const create: RequestHandler = async (req, res, next) => {
  try {
    const result = await createUser(req.body, req);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: ms(env.jwtRefreshExpiresIn as StringValue),
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePassword: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new Error("No user attached to request.");
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const result = await changePassword(
      req.user._id,
      currentPassword,
      newPassword
    );

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

export const searchDirectory: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as { search?: string; page?: number; limit?: number };
    const result = await searchUserDirectory({
      ...(query.search ? { search: query.search } : {}),
      ...(query.page ? { page: query.page } : {}),
      ...(query.limit ? { limit: query.limit } : {}),
    });
    res.status(200).json({ success: true, data: result, message: "Users fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getMyProfile: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }

    const user = await getMyProfileService(req.user._id.toString());

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

export const updateProfile: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const input = updateProfileSchema.parse(req.body);
    const user  = await updateProfileService(req.user._id, input);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data:    { user },
    });
  } catch (err) {
    next(err);
  }
};