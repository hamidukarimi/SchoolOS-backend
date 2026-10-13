import mongoose from "mongoose";
import Class from "../models/Class.model.js";
import type { IExam } from "../models/Exam.model.js";
import type { IGrade } from "../models/Grade.model.js";
import type { IAttendance } from "../models/Attendance.model.js";
import type { ITimetable } from "../models/Timetable.model.js";
import Student from "../models/Student.model.js";
import Teacher from "../models/Teacher.model.js";
import {
  attendanceDedupeKey,
  calendarDay,
  examDedupeKey,
  examFingerprint,
  gradeDedupeKey,
  shouldNotifyAttendanceUpdate,
  shouldNotifyGradeUpdate,
  timetableDedupeKey,
  timetableFingerprint,
  uniqueRecipientIds,
} from "../utils/notificationRules.js";
import { notifySafely } from "./notification.service.js";
import type { NotificationDraftInput } from "../validators/notification.validator.js";

async function studentUserId(studentId: unknown): Promise<string | null> {
  if (!studentId) return null;
  const student = await Student.findById(studentId).select("userId");
  return student?.userId ? student.userId.toString() : null;
}

function objectIds(values: readonly unknown[]): mongoose.Types.ObjectId[] {
  const ids: mongoose.Types.ObjectId[] = [];
  for (const value of values) {
    if (value instanceof mongoose.Types.ObjectId) ids.push(value);
    else if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
      ids.push(new mongoose.Types.ObjectId(value));
    }
  }
  return ids;
}

async function classAudience(classId: unknown, teacherIds: readonly unknown[]): Promise<string[]> {
  const classRecord = classId ? await Class.findById(classId).select("students teacherId") : null;
  const studentIds = objectIds(classRecord?.students ?? []);
  const students = studentIds.length
    ? await Student.find({ _id: { $in: studentIds } }).select("userId")
    : [];
  const teacherDocIds = objectIds([
    ...teacherIds,
    classRecord?.teacherId,
  ]);
  const teachers = teacherDocIds.length
    ? await Teacher.find({ _id: { $in: teacherDocIds } }).select("userId")
    : [];
  return uniqueRecipientIds([
    ...students.map((student) => student.userId.toString()),
    ...teachers.map((teacher) => teacher.userId.toString()),
  ]);
}

function copiesFor(recipients: string[], draft: Omit<NotificationDraftInput, "recipientId">): NotificationDraftInput[] {
  return recipients.map((recipientId) => ({ ...draft, recipientId }));
}

export async function notifyAttendanceSaved(
  attendance: IAttendance,
  previousStatus?: string,
): Promise<void> {
  const created = previousStatus === undefined;
  if (!created && !shouldNotifyAttendanceUpdate(previousStatus, attendance.status)) return;
  const recipientId = await studentUserId(attendance.studentId);
  if (!recipientId) return;
  const day = calendarDay(attendance.date);
  const recordId = attendance._id.toString();
  await notifySafely([
    {
      recipientId,
      type: "attendance",
      title: created ? "Attendance recorded" : "Attendance updated",
      body: `Your attendance on ${day} is ${attendance.status}.`,
      link: `/app/attendance/${recordId}`,
      dedupeKey: attendanceDedupeKey(recordId, attendance.status, day, created),
      metadata: { recordId, status: attendance.status },
    },
  ]);
}

export async function notifyGradeSaved(grade: IGrade, previous?: { marksObtained: number; totalMarks: number }): Promise<void> {
  const created = previous === undefined;
  if (!created && !shouldNotifyGradeUpdate(previous, grade)) return;
  const recipientId = await studentUserId(grade.studentId);
  if (!recipientId) return;
  const recordId = grade._id.toString();
  await notifySafely([
    {
      recipientId,
      type: "grade",
      title: created ? "Result recorded" : "Result updated",
      body: `Your ${grade.subject} result is ${grade.marksObtained}/${grade.totalMarks}.`,
      link: `/app/grades/${recordId}`,
      dedupeKey: gradeDedupeKey(recordId, grade.marksObtained, grade.totalMarks, created),
      metadata: { recordId, subject: grade.subject },
    },
  ]);
}

function examShape(exam: IExam) {
  return {
    title: exam.title,
    subject: exam.subject,
    status: exam.status,
    day: calendarDay(exam.date),
    classId: exam.classId.toString(),
    startTime: exam.startTime,
    endTime: exam.endTime,
  };
}

export async function notifyExamSaved(exam: IExam, previous?: IExam): Promise<void> {
  const next = examFingerprint(examShape(exam));
  if (previous && examFingerprint(examShape(previous)) === next) return;
  const recipients = await classAudience(exam.classId, [exam.teacherId]);
  const examId = exam._id.toString();
  await notifySafely(
    copiesFor(recipients, {
      type: "exam",
      title: previous ? "Exam updated" : "Exam scheduled",
      body: `${exam.title} (${exam.subject}) is ${exam.status} on ${calendarDay(exam.date)}.`,
      link: `/app/exams/${examId}`,
      dedupeKey: examDedupeKey(examId, next),
      metadata: { recordId: examId, subject: exam.subject, status: exam.status },
    }),
  );
}

function timetableShape(entry: ITimetable) {
  return {
    subject: entry.subject,
    dayOfWeek: entry.dayOfWeek,
    startTime: entry.startTime,
    endTime: entry.endTime,
    status: entry.status,
    classId: entry.classId.toString(),
    teacherId: entry.teacherId.toString(),
  };
}

export async function notifyTimetableSaved(entry: ITimetable, previous?: ITimetable): Promise<void> {
  const next = timetableFingerprint(timetableShape(entry));
  if (previous && timetableFingerprint(timetableShape(previous)) === next) return;
  const recipients = await classAudience(entry.classId, [entry.teacherId]);
  const entryId = entry._id.toString();
  await notifySafely(
    copiesFor(recipients, {
      type: "timetable",
      title: previous ? "Lesson updated" : "Lesson added",
      body: `${entry.subject} is ${entry.dayOfWeek} from ${entry.startTime} to ${entry.endTime}.`,
      link: `/app/timetables/${entryId}`,
      dedupeKey: timetableDedupeKey(entryId, next),
      metadata: { recordId: entryId, subject: entry.subject, dayOfWeek: entry.dayOfWeek, status: entry.status },
    }),
  );
}
