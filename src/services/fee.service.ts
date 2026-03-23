import Fee from "../models/Fee.model.js";
import type { IFee } from "../models/Fee.model.js";
import ApiError from "../utils/ApiError.js";

export const createFeeService = async (data: Partial<IFee>) => {
  const fee = await Fee.create(data);
  return fee;
};

export const getAllFeesService = async (filters: {
  studentId?: string;
  status?: string;
  academicYear?: string;
  term?: string;
  page?: number;
  limit?: number;
}) => {
  const { studentId, status, academicYear, term, page = 1, limit = 20 } = filters;

  const query: any = {};

  if (studentId) query.studentId = studentId;
  if (status) query.status = status;
  if (academicYear) query.academicYear = academicYear;
  if (term) query.term = term;

  const skip = (page - 1) * limit;

  const [fees, total] = await Promise.all([
    Fee.find(query)
      .populate("studentId", "firstName lastName studentId")
      .skip(skip)
      .limit(limit)
      .sort({ dueDate: 1 }),
    Fee.countDocuments(query),
  ]);

  return {
    fees,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getFeeByIdService = async (id: string) => {
  const fee = await Fee.findById(id).populate(
    "studentId",
    "firstName lastName studentId"
  );

  if (!fee) {
    throw new ApiError(404, "Fee record not found");
  }

  return fee;
};

export const updateFeeService = async (id: string, data: Partial<IFee>) => {
  const fee = await Fee.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!fee) {
    throw new ApiError(404, "Fee record not found");
  }

  return fee;
};

export const deleteFeeService = async (id: string) => {
  const fee = await Fee.findByIdAndDelete(id);

  if (!fee) {
    throw new ApiError(404, "Fee record not found");
  }

  return fee;
};

export const recordPaymentService = async (
  id: string,
  paidAmount: number,
  paidDate?: string
) => {
  const fee = await Fee.findById(id);

  if (!fee) {
    throw new ApiError(404, "Fee record not found");
  }

  if (fee.status === "paid") {
    throw new ApiError(400, "Fee is already fully paid");
  }

  fee.paidAmount += paidAmount;
  fee.paidDate = paidDate ? new Date(paidDate) : new Date();

  if (fee.paidAmount >= fee.amount) {
    fee.paidAmount = fee.amount;
    fee.status = "paid";
  } else {
    fee.status = "partial";
  }

  await fee.save();
  return fee;
};

export const getStudentFeeSummaryService = async (
  studentId: string,
  academicYear?: string
) => {
  const query: any = { studentId };
  if (academicYear) query.academicYear = academicYear;

  const fees = await Fee.find(query);

  const totalAmount = fees.reduce((sum, f) => sum + f.amount, 0);
  const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
  const totalPending = totalAmount - totalPaid;
  const overdue = fees.filter((f) => f.status === "overdue").length;
  const paid = fees.filter((f) => f.status === "paid").length;
  const partial = fees.filter((f) => f.status === "partial").length;
  const pending = fees.filter((f) => f.status === "pending").length;

  return {
    totalAmount,
    totalPaid,
    totalPending,
    overdue,
    paid,
    partial,
    pending,
    total: fees.length,
  };
};