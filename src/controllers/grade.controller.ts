import type { Request, Response, NextFunction } from "express";
import {
  createGradeService,
  bulkCreateGradeService,
  getAllGradesService,
  getGradeByIdService,
  updateGradeService,
  deleteGradeService,
  getStudentGradeSummaryService,
} from "../services/grade.service.js";

export const createGrade = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const grade = await createGradeService(req.body);
    res.status(201).json({ success: true, data: grade, message: "Grade created successfully" });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateGrade = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await bulkCreateGradeService(req.body);
    res.status(201).json({ success: true, data: result, message: "Bulk grades created successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAllGrades = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId, examId, classId, teacherId, subject, academicYear, page, limit } = req.query;

    const filters: {
      studentId?: string;
      examId?: string;
      classId?: string;
      teacherId?: string;
      subject?: string;
      academicYear?: string;
      page?: number;
      limit?: number;
    } = {};

    if (studentId) filters.studentId = studentId as string;
    if (examId) filters.examId = examId as string;
    if (classId) filters.classId = classId as string;
    if (teacherId) filters.teacherId = teacherId as string;
    if (subject) filters.subject = subject as string;
    if (academicYear) filters.academicYear = academicYear as string;
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await getAllGradesService(filters);
    res.status(200).json({ success: true, data: result, message: "Grades fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getGradeById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Grade ID is required" });
      return;
    }
    const grade = await getGradeByIdService(id);
    res.status(200).json({ success: true, data: grade, message: "Grade fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateGrade = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Grade ID is required" });
      return;
    }
    const grade = await updateGradeService(id, req.body);
    res.status(200).json({ success: true, data: grade, message: "Grade updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const deleteGrade = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Grade ID is required" });
      return;
    }
    await deleteGradeService(id);
    res.status(200).json({ success: true, data: null, message: "Grade deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getStudentGradeSummary = async (
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
    const summary = await getStudentGradeSummaryService(
      studentId,
      academicYear as string | undefined
    );
    res.status(200).json({ success: true, data: summary, message: "Grade summary fetched successfully" });
  } catch (error) {
    next(error);
  }
};