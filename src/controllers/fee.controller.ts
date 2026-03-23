import type { Request, Response, NextFunction } from "express";
import {
  createFeeService,
  getAllFeesService,
  getFeeByIdService,
  updateFeeService,
  deleteFeeService,
  recordPaymentService,
  getStudentFeeSummaryService,
} from "../services/fee.service.js";

export const createFee = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const fee = await createFeeService(req.body);
    res.status(201).json({ success: true, data: fee, message: "Fee created successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAllFees = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId, status, academicYear, term, page, limit } = req.query;

    const filters: {
      studentId?: string;
      status?: string;
      academicYear?: string;
      term?: string;
      page?: number;
      limit?: number;
    } = {};

    if (studentId) filters.studentId = studentId as string;
    if (status) filters.status = status as string;
    if (academicYear) filters.academicYear = academicYear as string;
    if (term) filters.term = term as string;
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await getAllFeesService(filters);
    res.status(200).json({ success: true, data: result, message: "Fees fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getFeeById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Fee ID is required" });
      return;
    }
    const fee = await getFeeByIdService(id);
    res.status(200).json({ success: true, data: fee, message: "Fee fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateFee = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Fee ID is required" });
      return;
    }
    const fee = await updateFeeService(id, req.body);
    res.status(200).json({ success: true, data: fee, message: "Fee updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const deleteFee = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Fee ID is required" });
      return;
    }
    await deleteFeeService(id);
    res.status(200).json({ success: true, data: null, message: "Fee deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const recordPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Fee ID is required" });
      return;
    }
    const { paidAmount, paidDate } = req.body;
    const fee = await recordPaymentService(id, paidAmount, paidDate);
    res.status(200).json({ success: true, data: fee, message: "Payment recorded successfully" });
  } catch (error) {
    next(error);
  }
};

export const getStudentFeeSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    if (!studentId || Array.isArray(studentId)) {
      res.status(400).json({ success: false, message: "Student ID is required" });
      return;
    }
    const { academicYear } = req.query;
    const summary = await getStudentFeeSummaryService(
      studentId,
      academicYear as string | undefined
    );
    res.status(200).json({ success: true, data: summary, message: "Fee summary fetched successfully" });
  } catch (error) {
    next(error);
  }
};