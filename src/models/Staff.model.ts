import mongoose, { Document, Schema } from "mongoose";

export interface IStaff extends Document {
  userId: mongoose.Types.ObjectId;
  staffId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: "male" | "female";
  phone?: string;
  address?: string;
  department: string;
  position: string;
  salary: number;
  joinDate: Date;
  contractType: "full-time" | "part-time" | "contract";
  status: "active" | "inactive" | "suspended" | "terminated";
  createdAt: Date;
  updatedAt: Date;
}

const StaffSchema = new Schema<IStaff>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    staffId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    position: {
      type: String,
      required: true,
      trim: true,
    },
    salary: {
      type: Number,
      required: true,
      min: 0,
    },
    joinDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    contractType: {
      type: String,
      enum: ["full-time", "part-time", "contract"],
      default: "full-time",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "terminated"],
      default: "active",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IStaff>("Staff", StaffSchema);