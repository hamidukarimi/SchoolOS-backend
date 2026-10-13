import { z } from "zod";

const userId = z.string().regex(/^[a-f\d]{24}$/i, "A valid user id is required");

export const createMessageSchema = z.object({
  receiverId: userId,
  subject: z.string().trim().min(1, "Subject is required"),
  content: z.string().trim().min(1, "Content is required"),
});

export const updateMessageSchema = z.object({
  isRead: z.boolean().optional(),
  readAt: z.string().optional(),
});