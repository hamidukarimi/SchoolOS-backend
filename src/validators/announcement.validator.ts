import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid id is required");
const audience = z.enum(["all", "teachers", "students", "parents"] as const);

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  audience: audience.optional(),
  classId: objectId.optional(),
  publishDate: z.string().optional(),
  expiryDate: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  audience: audience.optional(),
  classId: z.union([objectId, z.literal("")]).optional(),
  publishDate: z.string().optional(),
  expiryDate: z.string().optional(),
  isPublished: z.boolean().optional(),
});

export const listAnnouncementsQuerySchema = z.object({
  audience: audience.optional(),
  classId: objectId.optional(),
  isPublished: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const announcementIdParamsSchema = z.object({
  id: objectId,
});