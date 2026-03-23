import mongoose, { Document, Schema } from "mongoose";

export interface IAnnouncement extends Document {
  title: string;
  content: string;
  audience: "all" | "teachers" | "students" | "parents";
  classId?: mongoose.Types.ObjectId;
  publishedBy: mongoose.Types.ObjectId;
  publishDate: Date;
  expiryDate?: Date;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    audience: {
      type: String,
      enum: ["all", "teachers", "students", "parents"],
      default: "all",
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    publishDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);