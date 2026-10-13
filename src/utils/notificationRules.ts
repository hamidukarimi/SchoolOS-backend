import { createHash } from "node:crypto";

export function calendarDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function token(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "none";
}

export function attendanceDedupeKey(recordId: string, status: string, day: string, created: boolean): string {
  return `attendance:${recordId}:${created ? "recorded" : "updated"}:${status}:${day}`;
}

export function shouldNotifyAttendanceUpdate(previousStatus: string, nextStatus: string): boolean {
  return previousStatus !== nextStatus;
}

export function gradeDedupeKey(
  recordId: string,
  marksObtained: number,
  totalMarks: number,
  created: boolean,
): string {
  return `grade:${recordId}:${created ? "recorded" : "updated"}:${marksObtained}:${totalMarks}`;
}

export function shouldNotifyGradeUpdate(
  previous: { marksObtained: number; totalMarks: number },
  next: { marksObtained: number; totalMarks: number },
): boolean {
  return previous.marksObtained !== next.marksObtained || previous.totalMarks !== next.totalMarks;
}

export function examFingerprint(input: {
  title: string;
  subject: string;
  status: string;
  day: string;
  classId: string;
  startTime: string;
  endTime: string;
}): string {
  return [input.title, input.subject, input.status, input.day, input.classId, input.startTime, input.endTime]
    .map(token)
    .join(":");
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function examDedupeKey(examId: string, fingerprint: string): string {
  return `exam:${examId}:${digest(fingerprint)}`;
}

export function timetableFingerprint(input: {
  subject: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  status: string;
  classId: string;
  teacherId: string;
}): string {
  return [input.subject, input.dayOfWeek, input.startTime, input.endTime, input.status, input.classId, input.teacherId]
    .map(token)
    .join(":");
}

export function timetableDedupeKey(entryId: string, fingerprint: string): string {
  return `timetable:${entryId}:${digest(fingerprint)}`;
}

export function uniqueRecipientIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}
