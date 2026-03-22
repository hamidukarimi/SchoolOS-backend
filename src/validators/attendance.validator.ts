import { z } from "zod";

export const createAttendanceSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  classId: z.string().min(1, "Class ID is required"),
  teacherId: z.string().min(1, "Teacher ID is required"),
  date: z.string().min(1, "Date is required"),
  status: z.enum(["present", "absent", "late", "excused"] as const, {
    message: "Status must be present, absent, late or excused",
  }),
  note: z.string().optional(),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(["present", "absent", "late", "excused"] as const, {
    message: "Status must be present, absent, late or excused",
  }).optional(),
  note: z.string().optional(),
});

export const bulkAttendanceSchema = z.object({
  classId: z.string().min(1, "Class ID is required"),
  teacherId: z.string().min(1, "Teacher ID is required"),
  date: z.string().min(1, "Date is required"),
  records: z.array(
    z.object({
      studentId: z.string().min(1, "Student ID is required"),
      status: z.enum(["present", "absent", "late", "excused"] as const),
      note: z.string().optional(),
    })
  ).min(1, "At least one attendance record is required"),
});