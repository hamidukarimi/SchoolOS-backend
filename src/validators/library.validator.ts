import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid id is required");

export const createBookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  isbn: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  totalCopies: z.number().min(1, "Total copies must be at least 1"),
  availableCopies: z.number().min(0, "Available copies must be at least 0"),
  description: z.string().optional(),
  publishedYear: z.number().optional(),
  status: z.enum(["available", "unavailable"] as const).optional(),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  isbn: z.string().optional(),
  category: z.string().min(1).optional(),
  totalCopies: z.number().min(1).optional(),
  availableCopies: z.number().min(0).optional(),
  description: z.string().optional(),
  publishedYear: z.number().optional(),
  status: z.enum(["available", "unavailable"] as const).optional(),
});

export const borrowBookSchema = z.object({
  borrowerId: objectId,
  borrowerType: z.enum(["student", "teacher"] as const, {
    message: "Borrower type must be student or teacher",
  }),
  dueDate: z.string().min(1, "Due date is required"),
});

export const returnBookSchema = z.object({
  returnDate: z.string().optional(),
});