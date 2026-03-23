import Grade from "../models/Grade.model.js";
import type { IGrade } from "../models/Grade.model.js";
import ApiError from "../utils/ApiError.js";

export const createGradeService = async (data: Partial<IGrade>) => {
  const existing = await Grade.findOne({
    studentId: data.studentId,
    examId: data.examId,
  } as any);

  if (existing) {
    throw new ApiError(400, "Grade already recorded for this student in this exam");
  }

  const grade = await Grade.create(data);
  return grade;
};

export const bulkCreateGradeService = async (data: {
  examId: string;
  classId: string;
  teacherId: string;
  subject: string;
  academicYear: string;
  records: {
    studentId: string;
    marksObtained: number;
    totalMarks: number;
    remarks?: string;
  }[];
}) => {
  const { examId, classId, teacherId, subject, academicYear, records } = data;

  const gradeDocs = records.map((record) => ({
    examId,
    classId,
    teacherId,
    subject,
    academicYear,
    studentId: record.studentId,
    marksObtained: record.marksObtained,
    totalMarks: record.totalMarks,
    ...(record.remarks && { remarks: record.remarks }),
  }));

  const result = await Grade.insertMany(gradeDocs, { ordered: false });
  return result;
};

export const getAllGradesService = async (filters: {
  studentId?: string;
  examId?: string;
  classId?: string;
  teacherId?: string;
  subject?: string;
  academicYear?: string;
  page?: number;
  limit?: number;
}) => {
  const { studentId, examId, classId, teacherId, subject, academicYear, page = 1, limit = 20 } = filters;

  const query: any = {};

  if (studentId) query.studentId = studentId;
  if (examId) query.examId = examId;
  if (classId) query.classId = classId;
  if (teacherId) query.teacherId = teacherId;
  if (subject) query.subject = { $regex: subject, $options: "i" };
  if (academicYear) query.academicYear = academicYear;

  const skip = (page - 1) * limit;

  const [grades, total] = await Promise.all([
    Grade.find(query)
      .populate("studentId", "firstName lastName studentId")
      .populate("examId", "title date")
      .populate("classId", "name section grade")
      .populate("teacherId", "firstName lastName teacherId")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Grade.countDocuments(query),
  ]);

  return {
    grades,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getGradeByIdService = async (id: string) => {
  const grade = await Grade.findById(id)
    .populate("studentId", "firstName lastName studentId")
    .populate("examId", "title date totalMarks passingMarks")
    .populate("classId", "name section grade")
    .populate("teacherId", "firstName lastName teacherId");

  if (!grade) {
    throw new ApiError(404, "Grade not found");
  }

  return grade;
};

export const updateGradeService = async (
  id: string,
  data: Partial<IGrade>
) => {
  const grade = await Grade.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!grade) {
    throw new ApiError(404, "Grade not found");
  }

  return grade;
};

export const deleteGradeService = async (id: string) => {
  const grade = await Grade.findByIdAndDelete(id);

  if (!grade) {
    throw new ApiError(404, "Grade not found");
  }

  return grade;
};

export const getStudentGradeSummaryService = async (
  studentId: string,
  academicYear?: string
) => {
  const query: any = { studentId };
  if (academicYear) query.academicYear = academicYear;

  const grades = await Grade.find(query).populate("examId", "title passingMarks");

  const total = grades.length;
  const passed = grades.filter((g) => g.grade !== "F").length;
  const failed = total - passed;
  const averageMarks =
    total > 0
      ? grades.reduce((sum, g) => sum + (g.marksObtained / g.totalMarks) * 100, 0) / total
      : 0;

  return {
    total,
    passed,
    failed,
    averageMarks: Math.round(averageMarks * 100) / 100,
    grades,
  };
};