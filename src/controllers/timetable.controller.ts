import type { Request, Response, NextFunction } from "express";
import {
  createTimetableService,
  getAllTimetablesService,
  getTimetableByIdService,
  updateTimetableService,
  deleteTimetableService,
} from "../services/timetable.service.js";

export const createTimetable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const timetable = await createTimetableService(req.body);
    res.status(201).json({ success: true, data: timetable, message: "Timetable entry created successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAllTimetables = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { classId, teacherId, dayOfWeek, academicYear, page, limit } = req.query;

    const filters: {
      classId?: string;
      teacherId?: string;
      dayOfWeek?: string;
      academicYear?: string;
      page?: number;
      limit?: number;
    } = {};

    if (classId) filters.classId = classId as string;
    if (teacherId) filters.teacherId = teacherId as string;
    if (dayOfWeek) filters.dayOfWeek = dayOfWeek as string;
    if (academicYear) filters.academicYear = academicYear as string;
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await getAllTimetablesService(filters);
    res.status(200).json({ success: true, data: result, message: "Timetables fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getTimetableById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Timetable ID is required" });
      return;
    }
    const timetable = await getTimetableByIdService(id);
    res.status(200).json({ success: true, data: timetable, message: "Timetable entry fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateTimetable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Timetable ID is required" });
      return;
    }
    const timetable = await updateTimetableService(id, req.body);
    res.status(200).json({ success: true, data: timetable, message: "Timetable entry updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const deleteTimetable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Timetable ID is required" });
      return;
    }
    await deleteTimetableService(id);
    res.status(200).json({ success: true, data: null, message: "Timetable entry deleted successfully" });
  } catch (error) {
    next(error);
  }
};