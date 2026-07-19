import Staff from "../models/Staff.model.js";
import type { IStaff } from "../models/Staff.model.js";
import type { IUserDocument } from "../models/User.model.js";
import type { QueryFilter } from "mongoose";
import ApiError from "../utils/ApiError.js";
import { assertSchoolMutationAllowed } from "../utils/schoolReadAccess.js";

export const createStaffService = async (
  data: Partial<IStaff>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const duplicateClauses: QueryFilter<IStaff>[] = [];
  if (data.staffId) duplicateClauses.push({ staffId: data.staffId });
  if (data.userId) duplicateClauses.push({ userId: data.userId });

  const existing =
    duplicateClauses.length > 0
      ? await Staff.findOne({ $or: duplicateClauses })
      : null;

  if (existing) {
    throw new ApiError(400, "Staff with this ID or user already exists");
  }

  const staff = await Staff.create(data);
  return staff;
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

  const query: QueryFilter<IStaff> = {};

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
