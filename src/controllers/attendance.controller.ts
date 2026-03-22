import type { Request, Response, NextFunction } from "express";
import {
  createAttendanceService,
  bulkCreateAttendanceService,
  getAllAttendanceService,
  getAttendanceByIdService,
  updateAttendanceService,
  deleteAttendanceService,
  getStudentAttendanceSummaryService,
} from "../services/attendance.service.js";

export const createAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const attendance = await createAttendanceService(req.body);
    res.status(201).json({ success: true, data: attendance, message: "Attendance recorded successfully" });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await bulkCreateAttendanceService(req.body);
    res.status(201).json({ success: true, data: result, message: "Bulk attendance recorded successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAllAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId, classId, teacherId, status, date, page, limit } = req.query;

    const filters: {
      studentId?: string;
      classId?: string;
      teacherId?: string;
      status?: string;
      date?: string;
      page?: number;
      limit?: number;
    } = {};

    if (studentId) filters.studentId = studentId as string;
    if (classId) filters.classId = classId as string;
    if (teacherId) filters.teacherId = teacherId as string;
    if (status) filters.status = status as string;
    if (date) filters.date = date as string;
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await getAllAttendanceService(filters);
    res.status(200).json({ success: true, data: result, message: "Attendance fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Attendance ID is required" });
      return;
    }
    const attendance = await getAttendanceByIdService(id);
    res.status(200).json({ success: true, data: attendance, message: "Attendance fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Attendance ID is required" });
      return;
    }
    const attendance = await updateAttendanceService(id, req.body);
    res.status(200).json({ success: true, data: attendance, message: "Attendance updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const deleteAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Attendance ID is required" });
      return;
    }
    await deleteAttendanceService(id);
    res.status(200).json({ success: true, data: null, message: "Attendance record deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getStudentAttendanceSummary = async (
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
    const { classId } = req.query;
    const summary = await getStudentAttendanceSummaryService(
      studentId,
      classId as string | undefined
    );
    res.status(200).json({ success: true, data: summary, message: "Attendance summary fetched successfully" });
  } catch (error) {
    next(error);
  }
};