import { z } from "zod";

export const createFeeSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  amount: z.number().min(0, "Amount must be at least 0"),
  dueDate: z.string().min(1, "Due date is required"),
  academicYear: z.string().min(1, "Academic year is required"),
  term: z.string().min(1, "Term is required"),
  status: z
    .enum(["pending", "partial", "paid", "overdue"] as const)
    .optional(),
});

export const updateFeeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  amount: z.number().min(0).optional(),
  dueDate: z.string().optional(),
  academicYear: z.string().min(1).optional(),
  term: z.string().min(1).optional(),
  status: z
    .enum(["pending", "partial", "paid", "overdue"] as const)
    .optional(),
});

export const recordPaymentSchema = z.object({
  paidAmount: z.number().min(1, "Paid amount must be at least 1"),
  paidDate: z.string().optional(),
});