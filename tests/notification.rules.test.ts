import assert from "node:assert/strict";
import test from "node:test";
import {
  attendanceDedupeKey,
  examDedupeKey,
  examFingerprint,
  gradeDedupeKey,
  shouldNotifyAttendanceUpdate,
  shouldNotifyGradeUpdate,
  timetableDedupeKey,
  timetableFingerprint,
  uniqueRecipientIds,
} from "../src/utils/notificationRules.ts";
import {
  notificationDraftSchema,
  notificationLinkSchema,
  listNotificationsQuerySchema,
} from "../src/validators/notification.validator.ts";

const id = "64b000000000000000000001";

test("notification drafts reject unknown types, bad links, and open metadata", () => {
  assert.equal(notificationLinkSchema.safeParse("/app/grades/abc").success, true);
  assert.equal(notificationLinkSchema.safeParse("https://example.com").success, false);
  assert.equal(notificationLinkSchema.safeParse("/app/../admin").success, false);
  assert.equal(
    notificationDraftSchema.safeParse({
      recipientId: id,
      type: "message",
      title: "Hello",
      body: "Body",
      dedupeKey: "grade:1:recorded:1:1",
    }).success,
    false,
  );
  assert.equal(
    notificationDraftSchema.safeParse({
      recipientId: id,
      type: "grade",
      title: "Result recorded",
      body: "Your Mathematics result is 70/100.",
      link: "/app/grades/" + id,
      dedupeKey: "grade:" + id + ":recorded:70:100",
      metadata: { recordId: id, subject: "Mathematics", salary: 10 },
    }).success,
    false,
  );
  assert.equal(listNotificationsQuerySchema.safeParse({ page: "0", read: "all" }).success, false);
  assert.equal(listNotificationsQuerySchema.safeParse({ page: "2", limit: "20", read: "unread" }).success, true);
});

test("attendance and grade updates notify only when the recorded outcome changes", () => {
  assert.equal(shouldNotifyAttendanceUpdate("present", "present"), false);
  assert.equal(shouldNotifyAttendanceUpdate("present", "absent"), true);
  assert.equal(shouldNotifyGradeUpdate({ marksObtained: 70, totalMarks: 100 }, { marksObtained: 70, totalMarks: 100 }), false);
  assert.equal(shouldNotifyGradeUpdate({ marksObtained: 70, totalMarks: 100 }, { marksObtained: 80, totalMarks: 100 }), true);
  assert.equal(attendanceDedupeKey(id, "late", "2026-10-13", false), `attendance:${id}:updated:late:2026-10-13`);
  assert.equal(gradeDedupeKey(id, 80, 100, true), `grade:${id}:recorded:80:100`);
});

test("exam and timetable dedupe keys ignore description and room text", () => {
  const exam = {
    title: "Midterm",
    subject: "Mathematics",
    status: "scheduled",
    day: "2026-10-13",
    classId: id,
    startTime: "09:00",
    endTime: "10:30",
  };
  const same = examDedupeKey(id, examFingerprint(exam));
  assert.equal(examDedupeKey(id, examFingerprint({ ...exam, title: "Midterm" })), same);
  assert.notEqual(examDedupeKey(id, examFingerprint({ ...exam, status: "cancelled" })), same);

  const lesson = {
    subject: "Mathematics",
    dayOfWeek: "monday",
    startTime: "09:00",
    endTime: "09:45",
    status: "active",
    classId: id,
    teacherId: id,
  };
  const lessonKey = timetableDedupeKey(id, timetableFingerprint(lesson));
  assert.equal(timetableDedupeKey(id, timetableFingerprint({ ...lesson })), lessonKey);
  assert.notEqual(timetableDedupeKey(id, timetableFingerprint({ ...lesson, startTime: "10:00" })), lessonKey);
  assert.match(lessonKey, /^[a-z0-9:._|-]+$/i);
});

test("recipient ids are trimmed and repeated ids are kept once", () => {
  assert.deepEqual(uniqueRecipientIds([" a ", "a", "", "b"]), ["a", "b"]);
});
