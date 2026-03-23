import type { Request, Response, NextFunction } from "express";
import {
  createStaffService,
  getAllStaffService,
  getStaffByIdService,
  updateStaffService,
  deleteStaffService,
  getHRSummaryService,
} from "../services/hr.service.js";

export const createStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const staff = await createStaffService(req.body);
    res.status(201).json({ success: true, data: staff, message: "Staff member created successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAllStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, department, contractType, search, page, limit } = req.query;

    const filters: {
      status?: string;
      department?: string;
      contractType?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {};

    if (status) filters.status = status as string;
    if (department) filters.department = department as string;
    if (contractType) filters.contractType = contractType as string;
    if (search) filters.search = search as string;
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await getAllStaffService(filters);
    res.status(200).json({ success: true, data: result, message: "Staff fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getStaffById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Staff ID is required" });
      return;
    }
    const staff = await getStaffByIdService(id);
    res.status(200).json({ success: true, data: staff, message: "Staff member fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Staff ID is required" });
      return;
    }
    const staff = await updateStaffService(id, req.body);
    res.status(200).json({ success: true, data: staff, message: "Staff member updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const deleteStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Staff ID is required" });
      return;
    }
    await deleteStaffService(id);
    res.status(200).json({ success: true, data: null, message: "Staff member deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getHRSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const summary = await getHRSummaryService();
    res.status(200).json({ success: true, data: summary, message: "HR summary fetched successfully" });
  } catch (error) {
    next(error);
  }
};