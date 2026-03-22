import Teacher from "../models/Teacher.model.js";
import type { ITeacher } from "../models/Teacher.model.js";
import ApiError from "../utils/ApiError.js";

export const createTeacherService = async (data: Partial<ITeacher>) => {
  const existing = await Teacher.findOne({
    $or: [{ teacherId: data.teacherId }, { userId: data.userId }],
  } as any);

  if (existing) {
    throw new ApiError(400, "Teacher with this ID or user already exists");
  }

  const teacher = await Teacher.create(data);
  return teacher;
};

export const getAllTeachersService = async (filters: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const { status, search, page = 1, limit = 20 } = filters;

  const query: any = {};

  if (status) query.status = status;
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { teacherId: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
    ];
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

export const getTeacherByIdService = async (id: string) => {
  const teacher = await Teacher.findById(id).populate("userId", "email");

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return teacher;
};

export const updateTeacherService = async (
  id: string,
  data: Partial<ITeacher>
) => {
  const teacher = await Teacher.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return teacher;
};

export const deleteTeacherService = async (id: string) => {
  const teacher = await Teacher.findByIdAndDelete(id);

  if (!teacher) {
    throw new ApiError(404, "Teacher not found");
  }

  return teacher;
};