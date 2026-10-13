import mongoose from "mongoose";
import Student from "../models/Student.model.js";
import User from "../models/User.model.js";
import type { IStudent } from "../models/Student.model.js";
import ApiError from "../utils/ApiError.js";
import type { IUserDocument } from "../models/User.model.js";
import type { SchoolReadScope } from "../types/schoolReadScope.js";
import {
  assertSchoolDataAccess,
  assertSchoolMutationAllowed,
  idInObjectIdList,
} from "../utils/schoolReadAccess.js";

function duplicateProfile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

export const createStudentService = async (
  data: {
    userId?: string;
    studentId?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: IStudent["gender"];
    phone?: string;
    address?: string;
    classId?: string;
    parentName?: string;
    parentPhone?: string;
    parentEmail?: string;
    enrollmentDate?: string;
    status?: IStudent["status"];
  },
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);
  if (!data.userId || !mongoose.Types.ObjectId.isValid(data.userId)) {
    throw new ApiError(400, "A valid user id is required");
  }
  const account = await User.findById(data.userId).select("_id");
  if (!account) throw new ApiError(404, "User account not found");
  if (!data.studentId || !data.firstName || !data.lastName || !data.dateOfBirth || !data.gender || !data.parentName || !data.parentPhone) {
    throw new ApiError(400, "Student profile is missing required fields");
  }

  const existing = await Student.findOne({
    $or: [{ studentId: data.studentId }, { userId: data.userId }],
  } as Record<string, unknown>);
  if (existing) {
    throw new ApiError(400, "Student with this ID or user already exists");
  }

  try {
    return await Student.create({
      userId: data.userId,
      studentId: data.studentId,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.address ? { address: data.address } : {}),
      ...(data.classId ? { classId: data.classId } : {}),
      parentName: data.parentName,
      parentPhone: data.parentPhone,
      ...(data.parentEmail ? { parentEmail: data.parentEmail } : {}),
      ...(data.enrollmentDate ? { enrollmentDate: data.enrollmentDate } : {}),
      ...(data.status ? { status: data.status } : {}),
    });
  } catch (error) {
    if (duplicateProfile(error)) {
      throw new ApiError(400, "Student with this ID or user already exists");
    }
    throw error;
  }
};

export const getAllStudentsService = async (
  filters: {
    status?: string;
    classId?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);

  const { status, classId, search, page = 1, limit = 20 } = filters;

  const query: Record<string, unknown> = {};

  if (status) query.status = status;
  if (classId) query.classId = classId;
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { studentId: { $regex: search, $options: "i" } },
    ];
  }

  if (scope.kind === "student") {
    query._id = scope.studentDocId;
  } else if (scope.kind === "teacher") {
    if (scope.rosterStudentIds.length === 0) {
      query._id = { $in: [] };
    } else {
      query._id = { $in: scope.rosterStudentIds };
    }
  }

  const skip = (page - 1) * limit;

  const [students, total] = await Promise.all([
    Student.find(query)
      .populate("classId", "name section")
      .populate("userId", "email")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Student.countDocuments(query),
  ]);

  return {
    students,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getStudentByIdService = async (
  id: string,
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);

  if (scope.kind === "student" && id !== scope.studentDocId.toString()) {
    throw new ApiError(403, "You can only view your own student record.");
  }

  if (
    scope.kind === "teacher" &&
    !idInObjectIdList(id, scope.rosterStudentIds)
  ) {
    throw new ApiError(403, "You do not have access to this student.");
  }

  const student = await Student.findById(id)
    .populate("classId", "name section")
    .populate("userId", "email");

  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  return student;
};

export const updateStudentService = async (
  id: string,
  data: Partial<IStudent>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const student = await Student.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  return student;
};

export const deleteStudentService = async (
  id: string,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const student = await Student.findByIdAndDelete(id);

  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  return student;
};
