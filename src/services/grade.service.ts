import Grade from "../models/Grade.model.js";
import type { IGrade } from "../models/Grade.model.js";
import ApiError from "../utils/ApiError.js";
import type { IUserDocument } from "../models/User.model.js";
import type { SchoolReadScope } from "../types/schoolReadScope.js";
import {
  assertSchoolDataAccess,
  assertSchoolMutationAllowed,
  idInObjectIdList,
} from "../utils/schoolReadAccess.js";
import { notifyGradeSaved } from "./notificationEvents.js";

export const createGradeService = async (
  data: Partial<IGrade>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const existing = await Grade.findOne({
    studentId: data.studentId,
    examId: data.examId,
  } as Record<string, unknown>);

  if (existing) {
    throw new ApiError(
      400,
      "Grade already recorded for this student in this exam",
    );
  }

  const grade = await Grade.create(data);
  await notifyGradeSaved(grade);
  return grade;
};

export const bulkCreateGradeService = async (
  data: {
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
  },
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

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

const mergeTeacherGradeScope = (
  base: Record<string, unknown>,
  scope: Extract<SchoolReadScope, { kind: "teacher" }>,
): Record<string, unknown> => {
  const scopeOr = [
    { teacherId: scope.teacherDocId },
    ...(scope.rosterStudentIds.length > 0
      ? [{ studentId: { $in: scope.rosterStudentIds } }]
      : []),
  ];
  const existingAnd = base.$and as Record<string, unknown>[] | undefined;
  if (existingAnd) {
    return { $and: [...existingAnd, { $or: scopeOr }] };
  }
  if (Object.keys(base).length === 0) {
    return { $or: scopeOr };
  }
  return { $and: [base, { $or: scopeOr }] };
};

export const getAllGradesService = async (
  filters: {
    studentId?: string;
    examId?: string;
    classId?: string;
    teacherId?: string;
    subject?: string;
    academicYear?: string;
    page?: number;
    limit?: number;
  },
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);

  const {
    studentId,
    examId,
    classId,
    teacherId,
    subject,
    academicYear,
    page = 1,
    limit = 20,
  } = filters;

  const base: Record<string, unknown> = {};

  if (examId) base.examId = examId;
  if (subject) base.subject = { $regex: subject, $options: "i" };
  if (academicYear) base.academicYear = academicYear;

  let query: Record<string, unknown>;

  if (scope.kind === "student") {
    base.studentId = scope.studentDocId;
    if (classId && !idInObjectIdList(classId, scope.classIds)) {
      throw new ApiError(403, "You do not have access to this class.");
    }
    if (classId) base.classId = classId;
    query = base;
  } else if (scope.kind === "teacher") {
    if (studentId && !idInObjectIdList(studentId, scope.rosterStudentIds)) {
      throw new ApiError(403, "You do not have access to these grades.");
    }
    if (classId && !idInObjectIdList(classId, scope.taughtClassIds)) {
      throw new ApiError(403, "You do not have access to grades for this class.");
    }
    if (teacherId && teacherId !== scope.teacherDocId.toString()) {
      throw new ApiError(403, "You do not have access to these grades.");
    }
    if (studentId) base.studentId = studentId;
    if (classId) base.classId = classId;
    if (teacherId) base.teacherId = teacherId;
    query = mergeTeacherGradeScope(base, scope);
  } else {
    if (studentId) base.studentId = studentId;
    if (classId) base.classId = classId;
    if (teacherId) base.teacherId = teacherId;
    query = base;
  }

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

export const getGradeByIdService = async (id: string, scope: SchoolReadScope) => {
  assertSchoolDataAccess(scope);

  const raw = await Grade.findById(id).lean();
  if (!raw) {
    throw new ApiError(404, "Grade not found");
  }

  if (scope.kind === "student") {
    if (raw.studentId.toString() !== scope.studentDocId.toString()) {
      throw new ApiError(403, "You do not have access to this grade.");
    }
  } else if (scope.kind === "teacher") {
    const inRoster = idInObjectIdList(
      raw.studentId.toString(),
      scope.rosterStudentIds,
    );
    const own = raw.teacherId.toString() === scope.teacherDocId.toString();
    if (!inRoster && !own) {
      throw new ApiError(403, "You do not have access to this grade.");
    }
  }

  const grade = await Grade.findById(id)
    .populate("studentId", "firstName lastName studentId")
    .populate("examId", "title date totalMarks passingMarks")
    .populate("classId", "name section grade")
    .populate("teacherId", "firstName lastName teacherId");

  return grade!;
};

export const updateGradeService = async (
  id: string,
  data: Partial<IGrade>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const previous = await Grade.findById(id).select("marksObtained totalMarks");
  const grade = await Grade.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!grade) {
    throw new ApiError(404, "Grade not found");
  }

  if (previous) {
    await notifyGradeSaved(grade, {
      marksObtained: previous.marksObtained,
      totalMarks: previous.totalMarks,
    });
  }
  return grade;
};

export const deleteGradeService = async (
  id: string,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const grade = await Grade.findByIdAndDelete(id);

  if (!grade) {
    throw new ApiError(404, "Grade not found");
  }

  return grade;
};

export const getStudentGradeSummaryService = async (
  studentId: string,
  academicYear: string | undefined,
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);

  if (scope.kind === "student") {
    if (studentId !== scope.studentDocId.toString()) {
      throw new ApiError(403, "You can only view your own grade summary.");
    }
  } else if (scope.kind === "teacher") {
    if (!idInObjectIdList(studentId, scope.rosterStudentIds)) {
      throw new ApiError(403, "You do not have access to this student's grades.");
    }
  }

  const query: Record<string, unknown> = { studentId };
  if (academicYear) query.academicYear = academicYear;

  const grades = await Grade.find(query).populate("examId", "title passingMarks");

  const total = grades.length;
  const passed = grades.filter((g) => g.grade !== "F").length;
  const failed = total - passed;
  const averageMarks =
    total > 0
      ? grades.reduce(
          (sum, g) => sum + (g.marksObtained / g.totalMarks) * 100,
          0,
        ) / total
      : 0;

  return {
    total,
    passed,
    failed,
    averageMarks: Math.round(averageMarks * 100) / 100,
    grades,
  };
};
