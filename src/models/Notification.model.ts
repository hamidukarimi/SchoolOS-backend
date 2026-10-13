import mongoose, { Schema } from "mongoose";
import type { Document, Types } from "mongoose";

export const NOTIFICATION_TYPES = ["attendance", "grade", "exam", "timetable"] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationMetadata {
  recordId?: string;
  status?: string;
  subject?: string;
  dayOfWeek?: string;
}

export interface INotification extends Document {
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  readAt: Date | null;
  link?: string;
  metadata?: NotificationMetadata;
  dedupeKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const metadataSchema = new Schema<NotificationMetadata>(
  {
    recordId: { type: String, trim: true, maxlength: 64 },
    status: { type: String, trim: true, maxlength: 32 },
    subject: { type: String, trim: true, maxlength: 120 },
    dayOfWeek: { type: String, trim: true, maxlength: 16 },
  },
  { _id: false },
);

const NotificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    readAt: {
      type: Date,
      default: null,
    },
    link: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    metadata: {
      type: metadataSchema,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
  },
  { timestamps: true },
);

NotificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 });
NotificationSchema.index({ recipient: 1, readAt: 1 });
NotificationSchema.index({ recipient: 1, dedupeKey: 1 }, { unique: true });

export default mongoose.model<INotification>("Notification", NotificationSchema);
