import type { Request, Response, NextFunction } from "express";
import {
  createTeacherService,
  getAllTeachersService,
  getTeacherByIdService,
  updateTeacherService,
  deleteTeacherService,
} from "../services/teacher.service.js";

export const createTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teacher = await createTeacherService(req.body);
    res.status(201).json({ success: true, data: teacher, message: "Teacher created successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAllTeachers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, search, page, limit } = req.query;

    const filters: {
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {};

    if (status) filters.status = status as string;
    if (search) filters.search = search as string;
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await getAllTeachersService(filters);
    res.status(200).json({ success: true, data: result, message: "Teachers fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getTeacherById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Teacher ID is required" });
      return;
    }
    const teacher = await getTeacherByIdService(id);
    res.status(200).json({ success: true, data: teacher, message: "Teacher fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Teacher ID is required" });
      return;
    }
    const teacher = await updateTeacherService(id, req.body);
    res.status(200).json({ success: true, data: teacher, message: "Teacher updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const deleteTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Teacher ID is required" });
      return;
    }
    await deleteTeacherService(id);
    res.status(200).json({ success: true, data: null, message: "Teacher deleted successfully" });
  } catch (error) {
    next(error);
  }
};