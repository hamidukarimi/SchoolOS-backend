import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  audience: z
    .enum(["all", "teachers", "students", "parents"] as const)
    .optional(),
  classId: z.string().optional(),
  publishDate: z.string().optional(),
  expiryDate: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  audience: z
    .enum(["all", "teachers", "students", "parents"] as const)
    .optional(),
  classId: z.string().optional(),
  publishDate: z.string().optional(),
  expiryDate: z.string().optional(),
  isPublished: z.boolean().optional(),
});