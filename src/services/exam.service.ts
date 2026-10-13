import Exam from "../models/Exam.model.js";
import type { IExam } from "../models/Exam.model.js";
import ApiError from "../utils/ApiError.js";
import type { IUserDocument } from "../models/User.model.js";
import type { SchoolReadScope } from "../types/schoolReadScope.js";
import {
  assertSchoolDataAccess,
  assertSchoolMutationAllowed,
  idInObjectIdList,
} from "../utils/schoolReadAccess.js";
import { notifyExamSaved } from "./notificationEvents.js";

export const createExamService = async (
  data: Partial<IExam>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const exam = await Exam.create(data);
  await notifyExamSaved(exam);
  return exam;
};

export const getAllExamsService = async (
  filters: {
    classId?: string;
    teacherId?: string;
    subject?: string;
    status?: string;
    academicYear?: string;
    page?: number;
    limit?: number;
  },
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);

  const {
    classId,
    teacherId,
    subject,
    status,
    academicYear,
    page = 1,
    limit = 20,
  } = filters;

  const query: Record<string, unknown> = {};

  if (classId) query.classId = classId;
  if (teacherId) query.teacherId = teacherId;
  if (subject) query.subject = { $regex: subject, $options: "i" };
  if (status) query.status = status;
  if (academicYear) query.academicYear = academicYear;

  if (scope.kind === "teacher") {
    const orClause: Record<string, unknown>[] = [
      { teacherId: scope.teacherDocId },
    ];
    if (scope.taughtClassIds.length > 0) {
      orClause.push({ classId: { $in: scope.taughtClassIds } });
    }
    query.$or = orClause;
  } else if (scope.kind === "student") {
    if (scope.classIds.length === 0) {
      query._id = { $in: [] };
    } else {
      query.classId = { $in: scope.classIds };
    }
  }

  const skip = (page - 1) * limit;

  const [exams, total] = await Promise.all([
    Exam.find(query)
      .populate("classId", "name section grade")
      .populate("teacherId", "firstName lastName teacherId subject")
      .skip(skip)
      .limit(limit)
      .sort({ date: 1 }),
    Exam.countDocuments(query),
  ]);

  return {
    exams,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getExamByIdService = async (id: string, scope: SchoolReadScope) => {
  assertSchoolDataAccess(scope);

  const raw = await Exam.findById(id).lean();
  if (!raw) {
    throw new ApiError(404, "Exam not found");
  }

  const classIdStr = raw.classId.toString();
  const teacherIdStr = raw.teacherId.toString();

  if (scope.kind === "teacher") {
    const ok =
      teacherIdStr === scope.teacherDocId.toString() ||
      idInObjectIdList(classIdStr, scope.taughtClassIds);
    if (!ok) throw new ApiError(403, "You do not have access to this exam.");
  }

  if (scope.kind === "student") {
    if (!idInObjectIdList(classIdStr, scope.classIds)) {
      throw new ApiError(403, "You do not have access to this exam.");
    }
  }

  const exam = await Exam.findById(id)
    .populate("classId", "name section grade")
    .populate("teacherId", "firstName lastName teacherId subject");

  return exam!;
};

export const updateExamService = async (
  id: string,
  data: Partial<IExam>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const previous = await Exam.findById(id);
  const exam = await Exam.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  if (previous) await notifyExamSaved(exam, previous);
  else await notifyExamSaved(exam);
  return exam;
};

export const deleteExamService = async (
  id: string,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const exam = await Exam.findByIdAndDelete(id);

  if (!exam) {
    throw new ApiError(404, "Exam not found");
  }

  return exam;
};
