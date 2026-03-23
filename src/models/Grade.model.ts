import mongoose, { Document, Schema } from "mongoose";

export interface IGrade extends Document {
  studentId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  subject: string;
  marksObtained: number;
  totalMarks: number;
  grade?: string;
  remarks?: string;
  academicYear: string;
  createdAt: Date;
  updatedAt: Date;
}

const GradeSchema = new Schema<IGrade>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    examId: {
      type: Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    marksObtained: {
      type: Number,
      required: true,
      min: 0,
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    grade: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

GradeSchema.index({ studentId: 1, examId: 1 }, { unique: true });

const calculateGrade = (marksObtained: number, totalMarks: number): string => {
  const percentage = (marksObtained / totalMarks) * 100;
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
};

GradeSchema.pre("save", function () {
  this.grade = calculateGrade(this.marksObtained, this.totalMarks);
});

export default mongoose.model<IGrade>("Grade", GradeSchema);