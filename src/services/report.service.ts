import mongoose from "mongoose";
import Attendance from "../models/Attendance.model.js";
import Class from "../models/Class.model.js";
import Fee from "../models/Fee.model.js";
import Grade from "../models/Grade.model.js";
import type { SchoolReadScope } from "../types/schoolReadScope.js";
import ApiError from "../utils/ApiError.js";
import { toCsv } from "../utils/csv.js";
import { assertSchoolDataAccess, idInObjectIdList } from "../utils/schoolReadAccess.js";

const EXPORT_LIMIT = 1000;

type TeacherScope = Extract<SchoolReadScope, { kind: "teacher" }>;
type StudentScope = Extract<SchoolReadScope, { kind: "student" }>;

function pageLimit(page?: number, limit?: number) {
  const safePage = Number.isInteger(page) && (page ?? 0) > 0 ? (page as number) : 1;
  const requested = Number.isInteger(limit) ? (limit as number) : 20;
  const safeLimit = requested > 0 && requested <= 50 ? requested : 20;
  return { page: safePage, limit: safeLimit };
}

function useScope(scope: SchoolReadScope) {
  assertSchoolDataAccess(scope);
}

function assertDateOrder(from?: string, to?: string) {
  if (from && to && from > to) {
    throw new ApiError(400, "The start date must be on or before the end date.");
  }
}

function dayBound(value: string, end: boolean): Date {
  const [year, month, date] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== (month ?? 1) - 1 || utc.getUTCDate() !== date) {
    throw new ApiError(400, "A valid date is required");
  }
  return utc;
}

function emptyPage(page: number, limit: number) {
  return { total: 0, page, totalPages: 0 };
}

function classScope(scope: SchoolReadScope, filters: { academicYear?: string; classId?: string; status?: string }) {
  const query: Record<string, unknown> = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.status) query.status = filters.status;
  if (filters.classId) {
    if (scope.kind === "teacher" && !idInObjectIdList(filters.classId, scope.taughtClassIds)) {
      throw new ApiError(403, "You do not have access to this class.");
    }
    if (scope.kind === "student" && !idInObjectIdList(filters.classId, scope.classIds)) {
      throw new ApiError(403, "You do not have access to this class.");
    }
    query._id = new mongoose.Types.ObjectId(filters.classId);
  } else if (scope.kind === "teacher") {
    query._id = { $in: scope.taughtClassIds };
  } else if (scope.kind === "student") {
    const orClause: Record<string, unknown>[] = [{ students: scope.studentDocId }];
    if (scope.classIds.length > 0) orClause.push({ _id: { $in: scope.classIds } });
    query.$or = orClause;
  }
  return query;
}

function denyOtherStudent(scope: SchoolReadScope, studentId: string | undefined, message: string) {
  if (scope.kind === "student" && studentId && studentId !== scope.studentDocId.toString()) {
    throw new ApiError(403, message);
  }
  if (scope.kind === "teacher" && studentId && !idInObjectIdList(studentId, scope.rosterStudentIds)) {
    throw new ApiError(403, message);
  }
}

function teacherRecordScope(base: Record<string, unknown>, scope: TeacherScope) {
  const scopeOr = [
    { teacherId: scope.teacherDocId },
    ...(scope.rosterStudentIds.length > 0 ? [{ studentId: { $in: scope.rosterStudentIds } }] : []),
  ];
  if (Object.keys(base).length === 0) return { $or: scopeOr };
  return { $and: [base, { $or: scopeOr }] };
}

function person(value: unknown): { name: string; code: string } {
  if (!value || typeof value !== "object") return { name: "", code: "" };
  const record = value as { firstName?: string; lastName?: string; studentId?: string };
  return {
    name: `${record.firstName ?? ""} ${record.lastName ?? ""}`.trim(),
    code: record.studentId ?? "",
  };
}

function classLabel(value: unknown): { name: string; section: string } {
  if (!value || typeof value !== "object") return { name: "", section: "" };
  const record = value as { name?: string; section?: string };
  return { name: record.name ?? "", section: record.section ?? "" };
}

function isoDay(value: Date | string | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export async function classReportService(
  filters: { academicYear?: string; status?: string; page?: number; limit?: number },
  scope: SchoolReadScope,
  exporting = false,
) {
  useScope(scope);
  const { page, limit } = pageLimit(filters.page, filters.limit);
  const match = classScope(scope, filters);
  if (scope.kind === "teacher" && scope.taughtClassIds.length === 0) {
    return { rows: [], summary: { total: 0, studentCount: 0 }, ...emptyPage(page, limit) };
  }
  const summaryRows = await Class.aggregate<{ total: number; studentCount: number }>([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        studentCount: { $sum: { $size: { $ifNull: ["$students", []] } } },
      },
    },
  ]);
  const summary = summaryRows[0] ?? { total: 0, studentCount: 0 };
  if (exporting && summary.total > EXPORT_LIMIT) {
    throw new ApiError(400, "Narrow the filters. Exports include at most 1000 rows.");
  }
  const classes = await Class.find(match)
    .select("name section grade academicYear status capacity students")
    .sort({ name: 1, section: 1 })
    .skip(exporting ? 0 : (page - 1) * limit)
    .limit(exporting ? EXPORT_LIMIT : limit)
    .lean();
  const rows = classes.map((item) => ({
    id: item._id.toString(),
    name: item.name,
    section: item.section,
    grade: item.grade,
    academicYear: item.academicYear,
    status: item.status,
    studentCount: item.students?.length ?? 0,
    capacity: item.capacity,
  }));
  return {
    rows,
    summary: { total: summary.total, studentCount: summary.studentCount },
    total: summary.total,
    page: exporting ? 1 : page,
    totalPages: Math.ceil(summary.total / (exporting ? EXPORT_LIMIT : limit)),
  };
}

export async function enrollmentReportService(
  filters: { academicYear?: string; classId?: string; status?: string; page?: number; limit?: number },
  scope: SchoolReadScope,
  exporting = false,
) {
  useScope(scope);
  if (scope.kind === "student") {
    throw new ApiError(403, "You do not have access to the enrollment report.");
  }
  const { page, limit } = pageLimit(filters.page, filters.limit);
  const match = classScope(scope, filters);
  if (scope.kind === "teacher" && scope.taughtClassIds.length === 0 && !filters.classId) {
    return { rows: [], summary: { total: 0 }, ...emptyPage(page, limit) };
  }
  const pipeline: mongoose.PipelineStage[] = [
    { $match: match },
    { $unwind: "$students" },
    { $lookup: { from: "students", localField: "students", foreignField: "_id", as: "student" } },
    { $unwind: "$student" },
  ];
  if (filters.status) pipeline.push({ $match: { "student.status": filters.status } });
  const counted = await Class.aggregate<{ total: number }>([...pipeline, { $count: "total" }]);
  const total = counted[0]?.total ?? 0;
  if (exporting && total > EXPORT_LIMIT) {
    throw new ApiError(400, "Narrow the filters. Exports include at most 1000 rows.");
  }
  const docs = await Class.aggregate<{
    name: string;
    section: string;
    grade: string;
    academicYear: string;
    student: { studentId: string; firstName: string; lastName: string; status: string };
  }>([
    ...pipeline,
    { $sort: { "student.lastName": 1, "student.firstName": 1, name: 1 } },
    { $skip: exporting ? 0 : (page - 1) * limit },
    { $limit: exporting ? EXPORT_LIMIT : limit },
  ]);
  const rows = docs.map((item) => ({
    studentCode: item.student.studentId,
    firstName: item.student.firstName,
    lastName: item.student.lastName,
    status: item.student.status,
    className: item.name,
    section: item.section,
    grade: item.grade,
    academicYear: item.academicYear,
  }));
  return { rows, summary: { total }, total, page: exporting ? 1 : page, totalPages: Math.ceil(total / (exporting ? EXPORT_LIMIT : limit)) };
}

function attendanceQuery(
  filters: { classId?: string; studentId?: string; status?: string; from?: string; to?: string },
  scope: SchoolReadScope,
) {
  assertDateOrder(filters.from, filters.to);
  denyOtherStudent(scope, filters.studentId, "You do not have access to this student's attendance.");
  const base: Record<string, unknown> = {};
  if (filters.status) base.status = filters.status;
  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.$gte = dayBound(filters.from, false);
    if (filters.to) range.$lte = dayBound(filters.to, true);
    base.date = range;
  }
  if (scope.kind === "student") {
    if (filters.classId && !idInObjectIdList(filters.classId, scope.classIds)) {
      throw new ApiError(403, "You do not have access to this class.");
    }
    base.studentId = (scope as StudentScope).studentDocId;
    if (filters.classId) base.classId = filters.classId;
    return base;
  }
  if (scope.kind === "teacher") {
    if (filters.classId && !idInObjectIdList(filters.classId, scope.taughtClassIds)) {
      throw new ApiError(403, "You do not have access to attendance for this class.");
    }
    if (filters.studentId) base.studentId = filters.studentId;
    if (filters.classId) base.classId = filters.classId;
    return teacherRecordScope(base, scope);
  }
  if (filters.studentId) base.studentId = filters.studentId;
  if (filters.classId) base.classId = filters.classId;
  return base;
}

export async function attendanceReportService(
  filters: { classId?: string; studentId?: string; status?: string; from?: string; to?: string; page?: number; limit?: number },
  scope: SchoolReadScope,
  exporting = false,
) {
  useScope(scope);
  const { page, limit } = pageLimit(filters.page, filters.limit);
  const query = attendanceQuery(filters, scope);
  const [counts, total] = await Promise.all([
    Attendance.aggregate<{ _id: string; count: number }>([{ $match: query }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Attendance.countDocuments(query),
  ]);
  if (exporting && total > EXPORT_LIMIT) throw new ApiError(400, "Narrow the filters. Exports include at most 1000 rows.");
  const summary = { total, present: 0, absent: 0, late: 0, excused: 0 };
  for (const item of counts) {
    if (item._id === "present" || item._id === "absent" || item._id === "late" || item._id === "excused") {
      summary[item._id] = item.count;
    }
  }
  const records = await Attendance.find(query)
    .populate("studentId", "firstName lastName studentId")
    .populate("classId", "name section")
    .sort({ date: -1 })
    .skip(exporting ? 0 : (page - 1) * limit)
    .limit(exporting ? EXPORT_LIMIT : limit)
    .lean();
  const rows = records.map((item) => {
    const student = person(item.studentId);
    const course = classLabel(item.classId);
    return {
      id: item._id.toString(),
      date: isoDay(item.date),
      status: item.status,
      note: item.note ?? "",
      studentName: student.name,
      studentCode: student.code,
      className: course.name,
      section: course.section,
    };
  });
  return { rows, summary, total, page: exporting ? 1 : page, totalPages: Math.ceil(total / (exporting ? EXPORT_LIMIT : limit)) };
}

function gradeQuery(
  filters: { academicYear?: string; classId?: string; studentId?: string; subject?: string },
  scope: SchoolReadScope,
) {
  denyOtherStudent(scope, filters.studentId, "You do not have access to these grades.");
  const base: Record<string, unknown> = {};
  if (filters.academicYear) base.academicYear = filters.academicYear;
  if (filters.subject) base.subject = filters.subject;
  if (scope.kind === "student") {
    if (filters.classId && !idInObjectIdList(filters.classId, scope.classIds)) {
      throw new ApiError(403, "You do not have access to this class.");
    }
    base.studentId = (scope as StudentScope).studentDocId;
    if (filters.classId) base.classId = filters.classId;
    return base;
  }
  if (scope.kind === "teacher") {
    if (filters.classId && !idInObjectIdList(filters.classId, scope.taughtClassIds)) {
      throw new ApiError(403, "You do not have access to grades for this class.");
    }
    if (filters.studentId) base.studentId = filters.studentId;
    if (filters.classId) base.classId = filters.classId;
    return teacherRecordScope(base, scope);
  }
  if (filters.studentId) base.studentId = filters.studentId;
  if (filters.classId) base.classId = filters.classId;
  return base;
}

export async function gradeReportService(
  filters: { academicYear?: string; classId?: string; studentId?: string; subject?: string; page?: number; limit?: number },
  scope: SchoolReadScope,
  exporting = false,
) {
  useScope(scope);
  const { page, limit } = pageLimit(filters.page, filters.limit);
  const query = gradeQuery(filters, scope);
  const [summaryRows, total] = await Promise.all([
    Grade.aggregate<{ averagePercentage: number | null }>([
      { $match: query },
      {
        $group: {
          _id: null,
          averagePercentage: { $avg: { $multiply: [{ $divide: ["$marksObtained", "$totalMarks"] }, 100] } },
        },
      },
    ]),
    Grade.countDocuments(query),
  ]);
  if (exporting && total > EXPORT_LIMIT) throw new ApiError(400, "Narrow the filters. Exports include at most 1000 rows.");
  const average = summaryRows[0]?.averagePercentage;
  const records = await Grade.find(query)
    .populate("studentId", "firstName lastName studentId")
    .populate("examId", "title")
    .populate("classId", "name section")
    .sort({ createdAt: -1 })
    .skip(exporting ? 0 : (page - 1) * limit)
    .limit(exporting ? EXPORT_LIMIT : limit)
    .lean();
  const rows = records.map((item) => {
    const student = person(item.studentId);
    const course = classLabel(item.classId);
    const exam = item.examId && typeof item.examId === "object" && "title" in item.examId ? String(item.examId.title ?? "") : "";
    return {
      id: item._id.toString(),
      subject: item.subject,
      academicYear: item.academicYear,
      marksObtained: item.marksObtained,
      totalMarks: item.totalMarks,
      grade: item.grade ?? "",
      examTitle: exam,
      studentName: student.name,
      studentCode: student.code,
      className: course.name,
    };
  });
  return {
    rows,
    summary: { total, averagePercentage: typeof average === "number" ? Math.round(average * 100) / 100 : null },
    total,
    page: exporting ? 1 : page,
    totalPages: Math.ceil(total / (exporting ? EXPORT_LIMIT : limit)),
  };
}

function feeQuery(
  filters: { academicYear?: string; term?: string; studentId?: string; status?: string },
  scope: SchoolReadScope,
) {
  denyOtherStudent(scope, filters.studentId, "You do not have access to these fee records.");
  const query: Record<string, unknown> = {};
  if (filters.academicYear) query.academicYear = filters.academicYear;
  if (filters.term) query.term = filters.term;
  if (filters.status) query.status = filters.status;
  if (scope.kind === "student") {
    query.studentId = (scope as StudentScope).studentDocId;
  } else if (scope.kind === "teacher") {
    if (filters.studentId) query.studentId = filters.studentId;
    else if (scope.rosterStudentIds.length === 0) query._id = { $in: [] };
    else query.studentId = { $in: scope.rosterStudentIds };
  } else if (filters.studentId) {
    query.studentId = filters.studentId;
  }
  return query;
}

export async function feeReportService(
  filters: { academicYear?: string; term?: string; studentId?: string; status?: string; page?: number; limit?: number },
  scope: SchoolReadScope,
  exporting = false,
) {
  useScope(scope);
  const { page, limit } = pageLimit(filters.page, filters.limit);
  const query = feeQuery(filters, scope);
  const [summaryRows, total] = await Promise.all([
    Fee.aggregate<{
      totalAmount: number;
      totalPaid: number;
      pending: number;
      partial: number;
      paid: number;
      overdue: number;
    }>([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalPaid: { $sum: "$paidAmount" },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          partial: { $sum: { $cond: [{ $eq: ["$status", "partial"] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] } },
        },
      },
    ]),
    Fee.countDocuments(query),
  ]);
  if (exporting && total > EXPORT_LIMIT) throw new ApiError(400, "Narrow the filters. Exports include at most 1000 rows.");
  const raw = summaryRows[0];
  const summary = {
    total,
    totalAmount: raw?.totalAmount ?? 0,
    totalPaid: raw?.totalPaid ?? 0,
    totalPending: (raw?.totalAmount ?? 0) - (raw?.totalPaid ?? 0),
    pending: raw?.pending ?? 0,
    partial: raw?.partial ?? 0,
    paid: raw?.paid ?? 0,
    overdue: raw?.overdue ?? 0,
  };
  const records = await Fee.find(query)
    .populate("studentId", "firstName lastName studentId")
    .sort({ dueDate: 1 })
    .skip(exporting ? 0 : (page - 1) * limit)
    .limit(exporting ? EXPORT_LIMIT : limit)
    .lean();
  const rows = records.map((item) => {
    const student = person(item.studentId);
    return {
      id: item._id.toString(),
      title: item.title,
      academicYear: item.academicYear,
      term: item.term,
      status: item.status,
      amount: item.amount,
      paidAmount: item.paidAmount,
      outstanding: item.amount - item.paidAmount,
      dueDate: isoDay(item.dueDate),
      studentName: student.name,
      studentCode: student.code,
    };
  });
  return { rows, summary, total, page: exporting ? 1 : page, totalPages: Math.ceil(total / (exporting ? EXPORT_LIMIT : limit)) };
}

export function classReportCsv(rows: Awaited<ReturnType<typeof classReportService>>["rows"]) {
  return toCsv(
    ["Class", "Section", "Grade", "Academic year", "Status", "Students", "Capacity"],
    rows.map((row) => [row.name, row.section, row.grade, row.academicYear, row.status, row.studentCount, row.capacity]),
  );
}

export function enrollmentReportCsv(rows: Awaited<ReturnType<typeof enrollmentReportService>>["rows"]) {
  return toCsv(
    ["Student ID", "First name", "Last name", "Status", "Class", "Section", "Grade", "Academic year"],
    rows.map((row) => [row.studentCode, row.firstName, row.lastName, row.status, row.className, row.section, row.grade, row.academicYear]),
  );
}

export function attendanceReportCsv(rows: Awaited<ReturnType<typeof attendanceReportService>>["rows"]) {
  return toCsv(
    ["Date", "Status", "Student", "Student ID", "Class", "Section", "Note"],
    rows.map((row) => [row.date, row.status, row.studentName, row.studentCode, row.className, row.section, row.note]),
  );
}

export function gradeReportCsv(rows: Awaited<ReturnType<typeof gradeReportService>>["rows"]) {
  return toCsv(
    ["Student", "Student ID", "Class", "Subject", "Exam", "Academic year", "Marks", "Total marks", "Grade"],
    rows.map((row) => [row.studentName, row.studentCode, row.className, row.subject, row.examTitle, row.academicYear, row.marksObtained, row.totalMarks, row.grade]),
  );
}

export function feeReportCsv(rows: Awaited<ReturnType<typeof feeReportService>>["rows"]) {
  return toCsv(
    ["Student", "Student ID", "Title", "Academic year", "Term", "Status", "Amount", "Paid", "Outstanding", "Due date"],
    rows.map((row) => [row.studentName, row.studentCode, row.title, row.academicYear, row.term, row.status, row.amount, row.paidAmount, row.outstanding, row.dueDate]),
  );
}
