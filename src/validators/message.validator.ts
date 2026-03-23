import { z } from "zod";

export const createMessageSchema = z.object({
  receiverId: z.string().min(1, "Receiver ID is required"),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
});

export const updateMessageSchema = z.object({
  isRead: z.boolean().optional(),
  readAt: z.string().optional(),
});