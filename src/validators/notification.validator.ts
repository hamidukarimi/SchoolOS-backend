import { z } from "zod";
import { NOTIFICATION_TYPES } from "../models/Notification.model.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid id is required");

export const notificationLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^\/[A-Za-z0-9][A-Za-z0-9/_-]*$/, "Link must be an internal application path");

export const notificationMetadataSchema = z
  .object({
    recordId: z.string().trim().min(1).max(64).optional(),
    status: z.string().trim().min(1).max(32).optional(),
    subject: z.string().trim().min(1).max(120).optional(),
    dayOfWeek: z.string().trim().min(1).max(16).optional(),
  })
  .strict();

export const notificationDraftSchema = z.object({
  recipientId: objectId,
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  link: notificationLinkSchema.optional(),
  metadata: notificationMetadataSchema.optional(),
  dedupeKey: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9:._|-]+$/i, "Dedupe key is not valid"),
});

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  read: z.enum(["read", "unread"]).optional(),
});

export const notificationIdParamsSchema = z.object({
  id: objectId,
});

export type NotificationDraftInput = z.infer<typeof notificationDraftSchema>;
