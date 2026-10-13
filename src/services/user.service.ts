import type { Types } from "mongoose";
import type { Request } from "express";
import Student from "../models/Student.model.js";
import Teacher from "../models/Teacher.model.js";
import User from "../models/User.model.js";
import Session from "../models/Session.model.js";
import type { IUserDocument } from "../models/User.model.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js";
import ApiError from "../utils/ApiError.js";
import ms from "ms";
import type { StringValue } from "ms";
import env from "../config/env.js";
import type { UpdateProfileInput } from "../validators/user.validator.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateUserData {
  firstname: string;
  lastname: string;
  username: string;
  email: string;
  password: string;
  birthday?: Date;
  gender?: string;
  location?: {
    city?: string;
    country?: string;
  };
  avatar?: string;
}

interface CreateUserResult {
  user: IUserDocument;
  accessToken: string;
  refreshToken: string;
}

interface ChangePasswordResult {
  message: string;
}

// ─── Service Functions ────────────────────────────────────────────────────────

export const createUser = async (
  userData: CreateUserData,
  req: Request,
): Promise<CreateUserResult> => {
  const { firstname, lastname, username, email, password, birthday, gender, location, avatar } =
    userData;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(400, "Email already registered");
  }

  const user = await User.create({
    firstname,
    lastname,
    username,
    email,
    password,
    ...(birthday && { birthday }),
    ...(gender && { gender }),
    ...(location && { location }),
    ...(avatar && { avatar }),
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const session = new Session({
    user: user._id,
    userAgent: req.headers["user-agent"],
    ip: req.ip,
    expiresAt: new Date(Date.now() + ms(env.jwtRefreshExpiresIn as StringValue)),
  });

  session.setRefreshToken(refreshToken);
  await session.save();

  return { user, accessToken, refreshToken };
};

export const changePassword = async (
  userId: Types.ObjectId,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> => {
  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.password = newPassword;
  user.tokenVersion += 1;

  await user.save();

  await Session.deleteMany({ user: userId });

  return { message: "Password changed successfully. Please login again." };
};

export const getMyProfileService = async (userId: string) => {
  const user = await User.findById(userId).select("-password");

  if (!user) return null;

  return user;
};

export const updateProfileService = async (
  userId: Types.ObjectId,
  input: UpdateProfileInput,
): Promise<IUserDocument> => {
  const user = await User.findById(userId);

  if (!user) throw new ApiError(404, "User not found");

  if (input.username && input.username !== user.username) {
    const taken = await User.findOne({ username: input.username });
    if (taken) throw new ApiError(409, "Username already taken");
  }

  Object.assign(user, {
    ...(input.firstname && { firstname: input.firstname }),
    ...(input.lastname  && { lastname:  input.lastname  }),
    ...(input.username  && { username:  input.username  }),
    ...(input.avatar    && { avatar:    input.avatar    }),
    ...(input.birthday  && { birthday:  new Date(input.birthday) }),
    ...(input.gender    && { gender:    input.gender    }),
  });

  await user.save();
  return user;
};

function escapeSearch(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchUserDirectory(filters: { search?: string; page?: number; limit?: number }) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const search = filters.search?.trim() ?? "";
  if (search.length < 2) {
    return { users: [], total: 0, page, totalPages: 0 };
  }

  const pattern = new RegExp(escapeSearch(search), "i");
  const query = {
    $or: [{ firstname: pattern }, { lastname: pattern }, { username: pattern }, { email: pattern }],
  };
  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    User.find(query).select("firstname lastname username email").sort({ lastname: 1, firstname: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(query),
  ]);
  const ids = records.map((record) => record._id);
  const [students, teachers] = await Promise.all([
    Student.find({ userId: { $in: ids } }).select("userId").lean(),
    Teacher.find({ userId: { $in: ids } }).select("userId").lean(),
  ]);
  const studentIds = new Set(students.map((student) => student.userId.toString()));
  const teacherIds = new Set(teachers.map((teacher) => teacher.userId.toString()));

  return {
    users: records.map((record) => ({
      id: record._id.toString(),
      firstname: record.firstname,
      lastname: record.lastname,
      username: record.username,
      email: record.email,
      hasStudentProfile: studentIds.has(record._id.toString()),
      hasTeacherProfile: teacherIds.has(record._id.toString()),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}