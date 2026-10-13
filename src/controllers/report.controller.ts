import type { Request, Response, NextFunction } from "express";
import {
  attendanceReportCsv,
  attendanceReportService,
  classReportCsv,
  classReportService,
  enrollmentReportCsv,
  enrollmentReportService,
  feeReportCsv,
  feeReportService,
  gradeReportCsv,
  gradeReportService,
} from "../services/report.service.js";
import ApiError from "../utils/ApiError.js";

function scopeOf(req: Request) {
  if (!req.schoolReadScope) throw new ApiError(500, "School read scope not initialized");
  return req.schoolReadScope;
}

function sendCsv(res: Response, filename: string, body: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(body);
}

export const getClassReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await classReportService(req.query, scopeOf(req));
    res.status(200).json({ success: true, data: result, message: "Class report fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const exportClassReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await classReportService(req.query, scopeOf(req), true);
    sendCsv(res, "class-report.csv", classReportCsv(result.rows));
  } catch (error) {
    next(error);
  }
};

export const getEnrollmentReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await enrollmentReportService(req.query, scopeOf(req));
    res.status(200).json({ success: true, data: result, message: "Enrollment report fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const exportEnrollmentReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await enrollmentReportService(req.query, scopeOf(req), true);
    sendCsv(res, "enrollment-report.csv", enrollmentReportCsv(result.rows));
  } catch (error) {
    next(error);
  }
};

export const getAttendanceReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await attendanceReportService(req.query, scopeOf(req));
    res.status(200).json({ success: true, data: result, message: "Attendance report fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const exportAttendanceReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await attendanceReportService(req.query, scopeOf(req), true);
    sendCsv(res, "attendance-report.csv", attendanceReportCsv(result.rows));
  } catch (error) {
    next(error);
  }
};

export const getGradeReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await gradeReportService(req.query, scopeOf(req));
    res.status(200).json({ success: true, data: result, message: "Grade report fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const exportGradeReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await gradeReportService(req.query, scopeOf(req), true);
    sendCsv(res, "grade-report.csv", gradeReportCsv(result.rows));
  } catch (error) {
    next(error);
  }
};

export const getFeeReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await feeReportService(req.query, scopeOf(req));
    res.status(200).json({ success: true, data: result, message: "Fee report fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const exportFeeReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await feeReportService(req.query, scopeOf(req), true);
    sendCsv(res, "fee-report.csv", feeReportCsv(result.rows));
  } catch (error) {
    next(error);
  }
};
