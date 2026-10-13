import mongoose from "mongoose";
import Notification from "../models/Notification.model.js";
import type { INotification, NotificationMetadata } from "../models/Notification.model.js";
import User from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import { notificationDraftSchema, type NotificationDraftInput } from "../validators/notification.validator.js";

export interface NotificationDeliveryResult {
  created: number;
  skipped: number;
}

function duplicateOnly(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === 11000) return true;
  if (!("writeErrors" in error) || !Array.isArray(error.writeErrors) || error.writeErrors.length === 0) {
    return false;
  }
  return error.writeErrors.every((item) => {
    return Boolean(item) && typeof item === "object" && "code" in item && item.code === 11000;
  });
}

function metadataFor(input: NotificationDraftInput): NotificationMetadata | undefined {
  if (!input.metadata) return undefined;
  const metadata: NotificationMetadata = {};
  if (input.metadata.recordId) metadata.recordId = input.metadata.recordId;
  if (input.metadata.status) metadata.status = input.metadata.status;
  if (input.metadata.subject) metadata.subject = input.metadata.subject;
  if (input.metadata.dayOfWeek) metadata.dayOfWeek = input.metadata.dayOfWeek;
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function documentFor(input: NotificationDraftInput): {
  recipient: mongoose.Types.ObjectId;
  type: NotificationDraftInput["type"];
  title: string;
  body: string;
  dedupeKey: string;
  link?: string;
  metadata?: NotificationMetadata;
} {
  const metadata = metadataFor(input);
  return {
    recipient: new mongoose.Types.ObjectId(input.recipientId),
    type: input.type,
    title: input.title,
    body: input.body,
    dedupeKey: input.dedupeKey,
    ...(input.link ? { link: input.link } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export async function createNotifications(drafts: NotificationDraftInput[]): Promise<NotificationDeliveryResult> {
  const parsed = drafts.map((draft) => notificationDraftSchema.parse(draft));
  const seen = new Set<string>();
  const unique = parsed.filter((draft) => {
    const key = `${draft.recipientId}:${draft.dedupeKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length === 0) return { created: 0, skipped: 0 };

  const recipientIds = [...new Set(unique.map((draft) => draft.recipientId))];
  const users = await User.find({ _id: { $in: recipientIds } }).select("_id");
  const existing = new Set(users.map((user) => user._id.toString()));
  const deliverable = unique.filter((draft) => existing.has(draft.recipientId));
  const skipped = unique.length - deliverable.length;
  if (deliverable.length === 0) return { created: 0, skipped };

  try {
    const inserted = await Notification.insertMany(deliverable.map(documentFor), { ordered: false });
    return { created: inserted.length, skipped };
  } catch (error) {
    if (!duplicateOnly(error)) throw error;
    const insertedCount =
      error && typeof error === "object" && "insertedDocs" in error && Array.isArray(error.insertedDocs)
        ? error.insertedDocs.length
        : 0;
    return { created: insertedCount, skipped: skipped + (deliverable.length - insertedCount) };
  }
}

export async function notifySafely(drafts: NotificationDraftInput[]): Promise<void> {
  try {
    const result = await createNotifications(drafts);
    if (result.skipped > 0) {
      console.error(`Notification delivery skipped ${result.skipped} recipient(s).`);
    }
  } catch (error) {
    console.error(
      "Notification delivery failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function listMyNotifications(
  userId: string,
  filters: { page?: number; limit?: number; read?: "read" | "unread" },
): Promise<{ notifications: INotification[]; total: number; page: number; totalPages: number }> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const query: Record<string, unknown> = { recipient: userId };
  if (filters.read === "unread") query.readAt = null;
  if (filters.read === "read") query.readAt = { $ne: null };

  const skip = (page - 1) * limit;
  const [notifications, total] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(query),
  ]);

  return {
    notifications,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function countMyUnread(userId: string): Promise<number> {
  return Notification.countDocuments({ recipient: userId, readAt: null });
}

export async function getMyNotification(id: string, userId: string): Promise<INotification> {
  const notification = await Notification.findOne({ _id: id, recipient: userId });
  if (!notification) throw new ApiError(404, "Notification not found");
  return notification;
}

export async function markMyNotificationRead(id: string, userId: string): Promise<INotification> {
  const notification = await Notification.findOne({ _id: id, recipient: userId });
  if (!notification) throw new ApiError(404, "Notification not found");
  if (notification.readAt) return notification;
  notification.readAt = new Date();
  await notification.save();
  return notification;
}

export async function markAllMyNotificationsRead(userId: string): Promise<number> {
  const result = await Notification.updateMany(
    { recipient: userId, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount;
}

export async function deleteMyNotification(id: string, userId: string): Promise<void> {
  const result = await Notification.deleteOne({ _id: id, recipient: userId });
  if (result.deletedCount === 0) throw new ApiError(404, "Notification not found");
}
