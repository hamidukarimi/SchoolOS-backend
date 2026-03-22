import type { RequestHandler } from "express";
import type { StringValue } from "ms";
import { createUser, changePassword, getMyProfileService, getFollowedPagesService, toggleSavePostService, getSavedPostsService, updateProfileService } from "../services/user.service.js";
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



export const getFollowedPages: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const pages = await getFollowedPagesService(req.user._id);

    res.status(200).json({
      success: true,
      message: "Followed pages fetched successfully",
      data: { pages },
    });
  } catch (err) {
    next(err);
  }
};




export const toggleSavePost: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const { saved } = await toggleSavePostService(
      req.user._id,
      req.params.postId as string,
    );

    res.status(200).json({
      success: true,
      message: saved ? "Post saved" : "Post unsaved",
      data:    { saved },
    });
  } catch (err) {
    next(err);
  }
};

export const getSavedPosts: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const posts = await getSavedPostsService(req.user._id);

    res.status(200).json({
      success: true,
      message: "Saved posts fetched successfully",
      data:    { posts },
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