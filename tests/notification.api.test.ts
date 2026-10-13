import "./env-setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "../src/models/User.model.ts";
import Student from "../src/models/Student.model.ts";
import Teacher from "../src/models/Teacher.model.ts";
import Class from "../src/models/Class.model.ts";
import Notification from "../src/models/Notification.model.ts";
import { generateAccessToken } from "../src/utils/jwt.ts";
import { createNotifications, notifySafely } from "../src/services/notification.service.ts";
import {
  createAttendanceService,
  updateAttendanceService,
} from "../src/services/attendance.service.ts";
import { createGradeService, updateGradeService } from "../src/services/grade.service.ts";
import { createExamService, updateExamService } from "../src/services/exam.service.ts";
import { createTimetableService, updateTimetableService } from "../src/services/timetable.service.ts";

let mongo: MongoMemoryServer;
let server: http.Server;
let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

async function makeUser(role: "admin" | "user" = "user") {
  const label = nextId("user");
  return User.create({
    firstname: "Test",
    lastname: "User",
    username: label,
    email: `${label}@example.com`,
    password: "password1",
    role,
  });
}

async function makeStudent(userId: mongoose.Types.ObjectId) {
  return Student.create({
    userId,
    studentId: nextId("STU"),
    firstName: "Amina",
    lastName: "Noori",
    dateOfBirth: new Date("2012-01-01"),
    gender: "female",
    parentName: "Parent",
    parentPhone: "0700000000",
    enrollmentDate: new Date("2026-01-01"),
  });
}

async function makeTeacher(userId: mongoose.Types.ObjectId) {
  return Teacher.create({
    userId,
    teacherId: nextId("TCH"),
    firstName: "Karim",
    lastName: "Rahimi",
    dateOfBirth: new Date("1990-01-01"),
    gender: "male",
    joinDate: new Date("2020-01-01"),
  });
}

function tokenFor(user: { _id: { toString(): string }; role: string; tokenVersion: number }): string {
  return generateAccessToken(user);
}

function request(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; body: { success?: boolean; message?: string; data?: Record<string, unknown>; errors?: string[] } }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const address = server.address() as AddressInfo;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path,
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          resolve({
            status: res.statusCode ?? 0,
            body: text ? (JSON.parse(text) as { success?: boolean; message?: string; data?: Record<string, unknown> }) : {},
          });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { default: app } = await import("../src/app.ts");
  server = await new Promise<http.Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
});

test.after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await mongoose.disconnect();
  await mongo.stop();
});

test.beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
});

test("notification documents require a known type and a recipient", async () => {
  const user = await makeUser();
  await assert.rejects(
    Notification.create({
      recipient: user._id,
      type: "message",
      title: "Hello",
      body: "Body",
      dedupeKey: "bad-type",
    }),
  );
  await assert.rejects(
    Notification.create({
      type: "grade",
      title: "Hello",
      body: "Body",
      dedupeKey: "missing-recipient",
    }),
  );
});

test("notification routes require authentication and ignore a caller-supplied recipient", async () => {
  const owner = await makeUser();
  const other = await makeUser();
  await Notification.create({
    recipient: owner._id,
    type: "grade",
    title: "Result recorded",
    body: "Your Mathematics result is 70/100.",
    dedupeKey: "owner-grade",
  });
  await Notification.create({
    recipient: other._id,
    type: "grade",
    title: "Other result",
    body: "Your Science result is 80/100.",
    dedupeKey: "other-grade",
  });

  const unauthenticated = await request("GET", "/api/notifications");
  assert.equal(unauthenticated.status, 401);

  const listed = await request("GET", `/api/notifications?recipient=${other._id.toString()}`, tokenFor(owner));
  assert.equal(listed.status, 200);
  const notifications = listed.body.data?.notifications as { title: string }[];
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.title, "Result recorded");

  const invalid = await request("GET", "/api/notifications?page=0&read=all", tokenFor(owner));
  assert.equal(invalid.status, 400);
});

test("users can read, mark, and delete only their own notifications", async () => {
  const owner = await makeUser();
  const other = await makeUser();
  const own = await Notification.create({
    recipient: owner._id,
    type: "attendance",
    title: "Attendance recorded",
    body: "Your attendance on 2026-10-13 is present.",
    dedupeKey: "own-attendance",
  });
  const foreign = await Notification.create({
    recipient: other._id,
    type: "attendance",
    title: "Other attendance",
    body: "Your attendance on 2026-10-13 is absent.",
    dedupeKey: "foreign-attendance",
  });
  const missingId = new mongoose.Types.ObjectId().toString();
  const ownerToken = tokenFor(owner);

  const missing = await request("GET", `/api/notifications/${missingId}`, ownerToken);
  const hidden = await request("GET", `/api/notifications/${foreign._id.toString()}`, ownerToken);
  assert.equal(missing.status, 404);
  assert.equal(hidden.status, 404);
  assert.equal(missing.body.message, "Notification not found");
  assert.equal(hidden.body.message, missing.body.message);

  const markedForeign = await request("PATCH", `/api/notifications/${foreign._id.toString()}/read`, ownerToken);
  assert.equal(markedForeign.status, 404);
  assert.equal(markedForeign.body.message, "Notification not found");

  const marked = await request("PATCH", `/api/notifications/${own._id.toString()}/read`, ownerToken);
  assert.equal(marked.status, 200);
  const firstReadAt = (marked.body.data as { readAt?: string }).readAt;
  assert.ok(firstReadAt);
  const repeated = await request("PATCH", `/api/notifications/${own._id.toString()}/read`, ownerToken);
  assert.equal((repeated.body.data as { readAt?: string }).readAt, firstReadAt);

  const deletedForeign = await request("DELETE", `/api/notifications/${foreign._id.toString()}`, ownerToken);
  assert.equal(deletedForeign.status, 404);
  assert.equal(await Notification.countDocuments({ _id: foreign._id }), 1);

  const deleted = await request("DELETE", `/api/notifications/${own._id.toString()}`, ownerToken);
  assert.equal(deleted.status, 200);
  const afterDelete = await request("GET", "/api/notifications", ownerToken);
  assert.equal((afterDelete.body.data?.notifications as unknown[]).length, 0);
  const count = await request("GET", "/api/notifications/unread-count", ownerToken);
  assert.equal(count.body.data?.count, 0);
});

test("mark all read and pagination stay inside the current user's notifications", async () => {
  const owner = await makeUser();
  const other = await makeUser();
  const older = await Notification.create({
    recipient: owner._id,
    type: "exam",
    title: "Oldest",
    body: "Oldest exam notice.",
    dedupeKey: "page-1",
  });
  const middle = await Notification.create({
    recipient: owner._id,
    type: "exam",
    title: "Middle",
    body: "Middle exam notice.",
    dedupeKey: "page-2",
  });
  const newest = await Notification.create({
    recipient: owner._id,
    type: "exam",
    title: "Newest",
    body: "Newest exam notice.",
    dedupeKey: "page-3",
  });
  await Notification.collection.updateOne({ _id: older._id }, { $set: { createdAt: new Date("2026-10-01T00:00:00.000Z") } });
  await Notification.collection.updateOne({ _id: middle._id }, { $set: { createdAt: new Date("2026-10-02T00:00:00.000Z") } });
  await Notification.collection.updateOne({ _id: newest._id }, { $set: { createdAt: new Date("2026-10-03T00:00:00.000Z") } });
  await Notification.create({
    recipient: other._id,
    type: "exam",
    title: "Other exam",
    body: "Another user's exam.",
    dedupeKey: "other-page",
  });

  const page = await request("GET", "/api/notifications?page=1&limit=2", tokenFor(owner));
  const titles = (page.body.data?.notifications as { title: string }[]).map((item) => item.title);
  assert.deepEqual(titles, ["Newest", "Middle"]);
  assert.equal(page.body.data?.total, 3);
  assert.equal(page.body.data?.totalPages, 2);

  const unread = await request("GET", "/api/notifications/unread-count", tokenFor(owner));
  assert.equal(unread.body.data?.count, 3);
  const updated = await request("PATCH", "/api/notifications/read-all", tokenFor(owner));
  assert.equal(updated.body.data?.updated, 3);
  const ownerUnread = await request("GET", "/api/notifications/unread-count", tokenFor(owner));
  const otherUnread = await request("GET", "/api/notifications/unread-count", tokenFor(other));
  assert.equal(ownerUnread.body.data?.count, 0);
  assert.equal(otherUnread.body.data?.count, 1);
  const repeated = await request("PATCH", "/api/notifications/read-all", tokenFor(owner));
  assert.equal(repeated.body.data?.updated, 0);
});

test("notification creation skips unknown recipients and duplicate keys", async () => {
  const user = await makeUser();
  const draft = {
    recipientId: user._id.toString(),
    type: "timetable" as const,
    title: "Lesson added",
    body: "Mathematics is monday from 09:00 to 09:45.",
    dedupeKey: "timetable:once",
    link: "/app/timetables/64b000000000000000000001",
    metadata: { subject: "Mathematics", dayOfWeek: "monday" },
  };
  const first = await createNotifications([draft, draft]);
  assert.equal(first.created, 1);
  const second = await createNotifications([draft]);
  assert.equal(second.created, 0);
  assert.equal(second.skipped, 1);
  const unknown = await createNotifications([
    { ...draft, recipientId: new mongoose.Types.ObjectId().toString(), dedupeKey: "timetable:missing-user" },
  ]);
  assert.equal(unknown.created, 0);
  assert.equal(unknown.skipped, 1);
  assert.equal(await Notification.countDocuments(), 1);
});

test("school events notify only the affected users and failed saves do not notify", async () => {
  const admin = await makeUser("admin");
  const studentUser = await makeUser();
  const classmateUser = await makeUser();
  const teacherUser = await makeUser();
  const student = await makeStudent(studentUser._id);
  await makeStudent(classmateUser._id);
  const teacher = await makeTeacher(teacherUser._id);
  const schoolClass = await Class.create({
    name: "Grade 6",
    section: "A",
    grade: "6",
    teacherId: teacher._id,
    students: [student._id],
    capacity: 30,
    academicYear: "2026-2027",
  });
  const classId = schoolClass._id;
  const teacherId = teacher._id;

  const attendance = await createAttendanceService(
    {
      studentId: student._id,
      classId,
      teacherId,
      date: new Date("2026-10-13T00:00:00.000Z"),
      status: "present",
    },
    admin,
  );
  await assert.rejects(
    createAttendanceService(
      {
        studentId: student._id,
        classId,
        teacherId,
        date: new Date("2026-10-13T00:00:00.000Z"),
        status: "late",
      },
      admin,
    ),
    /already recorded/,
  );
  await updateAttendanceService(attendance._id.toString(), { note: "On time" }, admin);
  await updateAttendanceService(attendance._id.toString(), { status: "late" }, admin);
  const attendanceNotes = await Notification.find({ type: "attendance" });
  assert.equal(attendanceNotes.length, 2);
  assert.ok(attendanceNotes.every((note) => note.recipient.toString() === studentUser._id.toString()));

  const grade = await createGradeService(
    {
      studentId: student._id,
      examId: new mongoose.Types.ObjectId(),
      classId,
      teacherId,
      subject: "Mathematics",
      marksObtained: 70,
      totalMarks: 100,
      academicYear: "2026-2027",
    },
    admin,
  );
  await assert.rejects(
    createGradeService(
      {
        studentId: student._id,
        examId: new mongoose.Types.ObjectId(),
        classId,
        teacherId,
        subject: "Mathematics",
        academicYear: "2026-2027",
      },
      admin,
    ),
  );
  await updateGradeService(grade._id.toString(), { remarks: "Steady" }, admin);
  await updateGradeService(grade._id.toString(), { marksObtained: 88 }, admin);
  const gradeNotes = await Notification.find({ type: "grade" }).sort({ createdAt: 1 });
  assert.equal(gradeNotes.length, 2);
  assert.equal(gradeNotes[1]?.body, "Your Mathematics result is 88/100.");
  assert.ok(gradeNotes.every((note) => note.recipient.toString() === studentUser._id.toString()));

  const exam = await createExamService(
    {
      title: "Midterm",
      classId,
      subject: "Mathematics",
      teacherId,
      date: new Date("2026-10-20T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "10:30",
      totalMarks: 100,
      passingMarks: 40,
      academicYear: "2026-2027",
      status: "scheduled",
    },
    admin,
  );
  await updateExamService(exam._id.toString(), { description: "Bring a pencil" }, admin);
  await updateExamService(exam._id.toString(), { status: "cancelled" }, admin);
  const examNotes = await Notification.find({ type: "exam" });
  assert.equal(examNotes.length, 4);
  const examRecipients = [...new Set(examNotes.map((note) => note.recipient.toString()))].sort();
  assert.deepEqual(examRecipients, [studentUser._id.toString(), teacherUser._id.toString()].sort());

  const lesson = await createTimetableService(
    {
      classId,
      teacherId,
      subject: "Mathematics",
      dayOfWeek: "monday",
      startTime: "09:00",
      endTime: "09:45",
      room: "A1",
      academicYear: "2026-2027",
      status: "active",
    },
    admin,
  );
  await assert.rejects(
    createTimetableService(
      {
        classId,
        teacherId,
        subject: "Science",
        dayOfWeek: "monday",
        startTime: "09:15",
        endTime: "10:00",
        academicYear: "2026-2027",
        status: "active",
      },
      admin,
    ),
    /already has a class/,
  );
  await updateTimetableService(lesson._id.toString(), { room: "B2" }, admin);
  await updateTimetableService(lesson._id.toString(), { startTime: "11:00", endTime: "11:45" }, admin);
  const lessonNotes = await Notification.find({ type: "timetable" });
  assert.equal(lessonNotes.length, 4);
  assert.ok(
    lessonNotes.every((note) =>
      [studentUser._id.toString(), teacherUser._id.toString()].includes(note.recipient.toString()),
    ),
  );
});

test("a notification delivery failure does not undo a saved school record", async () => {
  const admin = await makeUser("admin");
  const studentUser = await makeUser();
  const student = await makeStudent(studentUser._id);
  const originalFind = User.find;
  const originalError = console.error;
  let logged = false;
  console.error = () => {
    logged = true;
  };
  User.find = (() => {
    throw new Error("recipient lookup failed");
  }) as typeof User.find;

  try {
    const saved = await createAttendanceService(
      {
        studentId: student._id,
        classId: new mongoose.Types.ObjectId(),
        teacherId: new mongoose.Types.ObjectId(),
        date: new Date("2026-10-14T00:00:00.000Z"),
        status: "present",
      },
      admin,
    );
    assert.ok(saved._id);
    assert.equal(await Notification.countDocuments(), 0);
    assert.equal(logged, true);
    await notifySafely([
      {
        recipientId: "not-an-id",
        type: "grade",
        title: "Result recorded",
        body: "Invalid draft",
        dedupeKey: "bad",
      },
    ]);
  } finally {
    User.find = originalFind;
    console.error = originalError;
  }
});
