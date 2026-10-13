import mongoose from "mongoose";
import Staff from "../models/Staff.model.js";
import type { IStaff } from "../models/Staff.model.js";
import User from "../models/User.model.js";
import type { IUserDocument } from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import { assertSchoolMutationAllowed } from "../utils/schoolReadAccess.js";

function requireObjectId(id: string): void {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "A valid id is required");
  }
}

function duplicateStaff(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

export const createStaffService = async (
  data: {
    userId?: string;
    staffId?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: IStaff["gender"];
    phone?: string;
    address?: string;
    department?: string;
    position?: string;
    salary?: number;
    joinDate?: string;
    contractType?: IStaff["contractType"];
    status?: IStaff["status"];
  },
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);
  if (!data.userId || !mongoose.Types.ObjectId.isValid(data.userId)) {
    throw new ApiError(400, "A valid user id is required");
  }
  const account = await User.findById(data.userId).select("_id");
  if (!account) throw new ApiError(404, "User account not found");
  if (
    !data.staffId ||
    !data.firstName ||
    !data.lastName ||
    !data.dateOfBirth ||
    !data.gender ||
    !data.department ||
    !data.position ||
    data.salary === undefined
  ) {
    throw new ApiError(400, "Staff record is missing required fields");
  }

  const existing = await Staff.findOne({
    $or: [{ staffId: data.staffId }, { userId: data.userId }],
  } as Record<string, unknown>);
  if (existing) {
    throw new ApiError(400, "Staff with this ID or user already exists");
  }

  try {
    return await Staff.create({
      userId: data.userId,
      staffId: data.staffId,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.address ? { address: data.address } : {}),
      department: data.department,
      position: data.position,
      salary: data.salary,
      ...(data.joinDate ? { joinDate: data.joinDate } : {}),
      ...(data.contractType ? { contractType: data.contractType } : {}),
      ...(data.status ? { status: data.status } : {}),
    });
  } catch (error) {
    if (duplicateStaff(error)) {
      throw new ApiError(400, "Staff with this ID or user already exists");
    }
    throw error;
  }
};

export const getAllStaffService = async (filters: {
  status?: string;
  department?: string;
  contractType?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const { status, department, contractType, search, page = 1, limit = 20 } = filters;

  const query: any = {};

  if (status) query.status = status;
  if (department) query.department = { $regex: department, $options: "i" };
  if (contractType) query.contractType = contractType;
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { staffId: { $regex: search, $options: "i" } },
      { position: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [staff, total] = await Promise.all([
    Staff.find(query)
      .populate("userId", "email")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Staff.countDocuments(query),
  ]);

  return {
    staff,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getStaffByIdService = async (id: string) => {
  requireObjectId(id);
  const staff = await Staff.findById(id).populate("userId", "email");

  if (!staff) {
    throw new ApiError(404, "Staff member not found");
  }

  return staff;
};

export const updateStaffService = async (
  id: string,
  data: Partial<IStaff>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);
  requireObjectId(id);

  const staff = await Staff.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!staff) {
    throw new ApiError(404, "Staff member not found");
  }

  return staff;
};

export const deleteStaffService = async (
  id: string,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);
  requireObjectId(id);

  const staff = await Staff.findByIdAndDelete(id);

  if (!staff) {
    throw new ApiError(404, "Staff member not found");
  }

  return staff;
};

export const getHRSummaryService = async () => {
  const [total, active, inactive, suspended, terminated, fullTime, partTime, contract] =
    await Promise.all([
      Staff.countDocuments(),
      Staff.countDocuments({ status: "active" }),
      Staff.countDocuments({ status: "inactive" }),
      Staff.countDocuments({ status: "suspended" }),
      Staff.countDocuments({ status: "terminated" }),
      Staff.countDocuments({ contractType: "full-time" }),
      Staff.countDocuments({ contractType: "part-time" }),
      Staff.countDocuments({ contractType: "contract" }),
    ]);

  const totalSalary = await Staff.aggregate([
    { $match: { status: "active" } },
    { $group: { _id: null, total: { $sum: "$salary" } } },
  ]);

  return {
    total,
    byStatus: { active, inactive, suspended, terminated },
    byContractType: { fullTime, partTime, contract },
    totalMonthlySalary: totalSalary[0]?.total ?? 0,
  };
};