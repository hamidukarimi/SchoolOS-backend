import { z } from "zod";

export const createGradeSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  examId: z.string().min(1, "Exam ID is required"),
  classId: z.string().min(1, "Class ID is required"),
  teacherId: z.string().min(1, "Teacher ID is required"),
  subject: z.string().min(1, "Subject is required"),
  marksObtained: z.number().min(0, "Marks obtained must be at least 0"),
  totalMarks: z.number().min(1, "Total marks must be at least 1"),
  remarks: z.string().optional(),
  academicYear: z.string().min(1, "Academic year is required"),
});

export const updateGradeSchema = z.object({
  marksObtained: z.number().min(0).optional(),
  totalMarks: z.number().min(1).optional(),
  remarks: z.string().optional(),
});

export const bulkCreateGradeSchema = z.object({
  examId: z.string().min(1, "Exam ID is required"),
  classId: z.string().min(1, "Class ID is required"),
  teacherId: z.string().min(1, "Teacher ID is required"),
  subject: z.string().min(1, "Subject is required"),
  academicYear: z.string().min(1, "Academic year is required"),
  records: z.array(
    z.object({
      studentId: z.string().min(1, "Student ID is required"),
      marksObtained: z.number().min(0, "Marks obtained must be at least 0"),
      totalMarks: z.number().min(1, "Total marks must be at least 1"),
      remarks: z.string().optional(),
    })
  ).min(1, "At least one grade record is required"),
});