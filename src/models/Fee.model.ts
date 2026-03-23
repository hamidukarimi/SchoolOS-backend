import mongoose, { Document, Schema } from "mongoose";

export interface IFee extends Document {
  studentId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  paidDate?: Date;
  status: "pending" | "partial" | "paid" | "overdue";
  academicYear: string;
  term: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeeSchema = new Schema<IFee>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["pending", "partial", "paid", "overdue"],
      default: "pending",
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    term: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IFee>("Fee", FeeSchema);