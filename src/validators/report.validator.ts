import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid id is required");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A valid date is required");
const page = z.coerce.number().int().positive().optional();
const limit = z.coerce.number().int().positive().max(50).optional();
const text = z.string().trim().min(1).optional();

export const classReportQuerySchema = z.object({
  academicYear: text,
  status: z.enum(["active", "inactive"]).optional(),
  page,
  limit,
});

export const enrollmentReportQuerySchema = z.object({
  academicYear: text,
  classId: objectId.optional(),
  status: z.enum(["active", "inactive", "suspended", "graduated"]).optional(),
  page,
  limit,
});

export const attendanceReportQuerySchema = z.object({
  classId: objectId.optional(),
  studentId: objectId.optional(),
  status: z.enum(["present", "absent", "late", "excused"]).optional(),
  from: day.optional(),
  to: day.optional(),
  page,
  limit,
});

export const gradeReportQuerySchema = z.object({
  academicYear: text,
  classId: objectId.optional(),
  studentId: objectId.optional(),
  subject: text,
  page,
  limit,
});

export const feeReportQuerySchema = z.object({
  academicYear: text,
  term: text,
  studentId: objectId.optional(),
  status: z.enum(["pending", "partial", "paid", "overdue"]).optional(),
  page,
  limit,
});
