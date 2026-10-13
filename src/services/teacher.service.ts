import type { Types } from "mongoose";
import mongoose from "mongoose";
import Teacher from "../models/Teacher.model.js";
import User from "../models/User.model.js";
import Class from "../models/Class.model.js";
import type { ITeacher } from "../models/Teacher.model.js";
import type { IUserDocument } from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import type { SchoolReadScope } from "../types/schoolReadScope.js";
import {
  assertSchoolDataAccess,
  assertSchoolMutationAllowed,
  idInObjectIdList,
} from "../utils/schoolReadAccess.js";

const visibleTeacherIdsForStudent = async (
  studentDocId: Types.ObjectId,
  classIds: Types.ObjectId[],
): Promise<Types.ObjectId[]> => {
  const classes = await Class.find({
    $or: [{ _id: { $in: classIds } }, { students: studentDocId }],
  })
    .select("teacherId")
    .lean();

  const set = new Set<string>();
  for (const c of classes) {
    if (c.teacherId) set.add(c.teacherId.toString());
  }
  return [...set].map((id) => new mongoose.Types.ObjectId(id));
};

function duplicateProfile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

export const createTeacherService = async (
  data: {
    userId?: string;
    teacherId?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: ITeacher["gender"];
    phone?: string;
    address?: string;
    subject?: string;
    qualification?: string;
    experience?: number;
    salary?: number;
    joinDate?: string;
    status?: ITeacher["status"];
  },
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);
  if (!data.userId || !mongoose.Types.ObjectId.isValid(data.userId)) {
    throw new ApiError(400, "A valid user id is required");
  }
  const account = await User.findById(data.userId).select("_id");
  if (!account) throw new ApiError(404, "User account not found");
  if (!data.teacherId || !data.firstName || !data.lastName || !data.dateOfBirth || !data.gender) {
    throw new ApiError(400, "Teacher profile is missing required fields");
  }

  const existing = await Teacher.findOne({
    $or: [{ teacherId: data.teacherId }, { userId: data.userId }],
  } as Record<string, unknown>);
  if (existing) {
    throw new ApiError(400, "Teacher with this ID or user already exists");
  }

  try {
    return await Teacher.create({
      userId: data.userId,
      teacherId: data.teacherId,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.address ? { address: data.address } : {}),
      ...(data.subject ? { subject: data.subject } : {}),
      ...(data.qualification ? { qualification: data.qualification } : {}),
      ...(data.experience !== undefined ? { experience: data.experience } : {}),
      ...(data.salary !== undefined ? { salary: data.salary } : {}),
      ...(data.joinDate ? { joinDate: data.joinDate } : {}),
      ...(data.status ? { status: data.status } : {}),
    });
  } catch (error) {
    if (duplicateProfile(error)) {
      throw new ApiError(400, "Teacher with this ID or user already exists");
    }
    throw error;
  }
};

export const getAllTeachersService = async (
  filters: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);

  const { status, search, page = 1, limit = 20 } = filters;

  const query: Record<string, unknown> = {};

  if (status) query.status = status;
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { teacherId: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
    ];
  }

  if (scope.kind === "teacher") {
    query._id = scope.teacherDocId;
  }

  if (scope.kind === "student") {
    const ids = await visibleTeacherIdsForStudent(
      scope.studentDocId,
      scope.classIds,
    );
    query._id = { $in: ids.length ? ids : [] };
  }

  const skip = (page - 1) * limit;

  const [teachers, total] = await Promise.all([
    Teacher.find(query)
      .populate("userId", "email")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Teacher.countDocuments(query),
  ]);

  return {
    teachers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getTeacherByIdService = async (
  id: string,
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);

  if (scope.kind === "teacher" && id !== scope.teacherDocId.toString()) {
    throw new ApiError(403, "You can only view your own teacher profile.");
  }

  if (scope.kind === "student") {
    const ids = await visibleTeacherIdsForStudent(
      scope.studentDocId,
      scope.classIds,
    );
    if (!idInObjectIdList(id, ids)) {
      throw new ApiError(403, "You do not have access to this teacher.");
    }
  }

  const teacher = await Teacher.findById(id).populate("userId", "email");

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return teacher;
};

export const updateTeacherService = async (
  id: string,
  data: Partial<ITeacher>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const teacher = await Teacher.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return teacher;
};

export const deleteTeacherService = async (
  id: string,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const teacher = await Teacher.findByIdAndDelete(id);

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return teacher;
};
