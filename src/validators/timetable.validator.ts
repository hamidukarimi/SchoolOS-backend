import { z } from "zod";

export const createTimetableSchema = z.object({
  classId: z.string().min(1, "Class ID is required"),
  teacherId: z.string().min(1, "Teacher ID is required"),
  subject: z.string().min(1, "Subject is required"),
  dayOfWeek: z.enum(
    ["monday", "tuesday", "wednesday", "thursday", "friday"] as const,
    { message: "Invalid day of week" }
  ),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  room: z.string().optional(),
  academicYear: z.string().min(1, "Academic year is required"),
  status: z.enum(["active", "inactive"] as const).optional(),
});

export const updateTimetableSchema = z.object({
  classId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  dayOfWeek: z
    .enum(["monday", "tuesday", "wednesday", "thursday", "friday"] as const)
    .optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
  room: z.string().optional(),
  academicYear: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"] as const).optional(),
});