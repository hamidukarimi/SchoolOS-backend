import "./env-setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Attendance from "../src/models/Attendance.model.ts";
import Class from "../src/models/Class.model.ts";
import Exam from "../src/models/Exam.model.ts";
import Fee from "../src/models/Fee.model.ts";
import Grade from "../src/models/Grade.model.ts";
import Student from "../src/models/Student.model.ts";
import Teacher from "../src/models/Teacher.model.ts";
import User from "../src/models/User.model.ts";
import { csvCell } from "../src/utils/csv.ts";
import { generateAccessToken } from "../src/utils/jwt.ts";

let mongo: MongoMemoryServer;
let server: http.Server;
let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

async function makeUser(role: "admin" | "user" = "user", name = "Person") {
  const label = nextId("user");
  return User.create({
    firstname: name,
    lastname: "Khan",
    username: label,
    email: `${label}@example.com`,
    password: "password1",
    role,
  });
}

function tokenFor(user: { _id: { toString(): string }; role: string; tokenVersion: number }): string {
  return generateAccessToken(user);
}

function request(
  method: string,
  path: string,
  token?: string,
): Promise<{ status: number; text: string; body: { message?: string; data?: Record<string, unknown> } }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as AddressInfo;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path,
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          let body: { message?: string; data?: Record<string, unknown> } = {};
          if (text && (res.headers["content-type"] ?? "").includes("json")) body = JSON.parse(text);
          resolve({ status: res.statusCode ?? 0, text, body });
        });
      },
    );
    req.on("error", reject);
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
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await mongoose.disconnect();
  await mongo.stop();
});

test.beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
});

test("reports follow school access and csv escapes formula text", async () => {
  assert.equal(csvCell(`=1+1, "x"`), `"'=1+1, ""x"""`);
  assert.equal(csvCell(null), "");

  const teacherAccount = await makeUser("user", "Laila");
  const otherTeacherAccount = await makeUser("user", "Sam");
  const studentAccount = await makeUser("user", "Omar");
  const outsiderAccount = await makeUser("user", "Other");
  const guest = await makeUser("user", "Guest");
  const student = await Student.create({
    userId: studentAccount._id,
    studentId: nextId("STU"),
    firstName: "Omar",
    lastName: "Khan",
    dateOfBirth: new Date("2012-04-01"),
    gender: "male",
    parentName: "Parent",
    parentPhone: "0700000000",
  });
  const outsider = await Student.create({
    userId: outsiderAccount._id,
    studentId: nextId("STU"),
    firstName: "Other",
    lastName: "Khan",
    dateOfBirth: new Date("2012-05-01"),
    gender: "female",
    parentName: "Parent",
    parentPhone: "0700000001",
  });
  const teacher = await Teacher.create({
    userId: teacherAccount._id,
    teacherId: nextId("TCH"),
    firstName: "Laila",
    lastName: "Noori",
    dateOfBirth: new Date("1990-01-01"),
    gender: "female",
  });
  const otherTeacher = await Teacher.create({
    userId: otherTeacherAccount._id,
    teacherId: nextId("TCH"),
    firstName: "Sam",
    lastName: "Noori",
    dateOfBirth: new Date("1991-01-01"),
    gender: "male",
  });
  const course = await Class.create({
    name: "Grade 6",
    section: "A",
    grade: "6",
    teacherId: teacher._id,
    students: [student._id],
    capacity: 30,
    academicYear: "2026",
  });
  const otherCourse = await Class.create({
    name: "Grade 7",
    section: "B",
    grade: "7",
    teacherId: otherTeacher._id,
    students: [outsider._id],
    capacity: 25,
    academicYear: "2026",
  });
  await Attendance.create({
    studentId: student._id,
    classId: course._id,
    teacherId: teacher._id,
    date: new Date("2026-02-02T00:00:00.000Z"),
    status: "present",
    note: `=1+1, "x"`,
  });
  await Attendance.create({
    studentId: outsider._id,
    classId: otherCourse._id,
    teacherId: otherTeacher._id,
    date: new Date("2026-02-02T00:00:00.000Z"),
    status: "absent",
    note: "away",
  });
  const exam = await Exam.create({
    title: "Midterm",
    classId: course._id,
    subject: "Math",
    teacherId: teacher._id,
    date: new Date("2026-03-01"),
    startTime: "09:00",
    endTime: "10:00",
    totalMarks: 100,
    passingMarks: 50,
    academicYear: "2026",
  });
  await Grade.create({
    studentId: student._id,
    examId: exam._id,
    classId: course._id,
    teacherId: teacher._id,
    subject: "Math",
    marksObtained: 85,
    totalMarks: 100,
    academicYear: "2026",
  });
  await Fee.create({
    studentId: student._id,
    title: "Tuition",
    amount: 100,
    paidAmount: 25,
    dueDate: new Date("2026-04-01"),
    status: "partial",
    academicYear: "2026",
    term: "1",
  });

  const studentToken = tokenFor(studentAccount);
  const teacherToken = tokenFor(teacherAccount);
  const guestToken = tokenFor(guest);

  assert.equal((await request("GET", "/api/reports/classes")).status, 401);
  assert.equal((await request("GET", "/api/reports/classes", guestToken)).status, 403);
  assert.equal((await request("GET", "/api/reports/enrollment", studentToken)).status, 403);
  assert.equal((await request("GET", "/api/reports/attendance?from=2026-13-40", studentToken)).status, 400);
  assert.equal((await request("GET", "/api/reports/attendance?from=2026-03-02&to=2026-03-01", studentToken)).status, 400);

  const classes = await request("GET", "/api/reports/classes?academicYear=2026", teacherToken);
  assert.equal(classes.status, 200);
  const classRows = classes.body.data?.rows as Array<{ name?: string }>;
  assert.deepEqual(classRows.map((row) => row.name), ["Grade 6"]);
  assert.equal((classes.body.data?.summary as { studentCount?: number }).studentCount, 1);

  const enrollment = await request("GET", "/api/reports/enrollment", teacherToken);
  const enrolled = enrollment.body.data?.rows as Array<{ studentCode?: string }>;
  assert.equal(enrolled.length, 1);
  assert.equal(enrolled[0]?.studentCode, student.studentId);
  assert.equal(JSON.stringify(enrollment.body).includes(outsider.studentId), false);

  const ownAttendance = await request("GET", `/api/reports/attendance?studentId=${outsider._id.toString()}`, studentToken);
  assert.equal(ownAttendance.status, 403);
  const attendance = await request("GET", "/api/reports/attendance?from=2026-02-01&to=2026-02-28", studentToken);
  assert.equal((attendance.body.data?.summary as { present?: number }).present, 1);
  assert.equal((attendance.body.data?.summary as { absent?: number }).absent, 0);
  const csv = await request("GET", "/api/reports/attendance.csv?from=2026-02-01&to=2026-02-28", studentToken);
  assert.equal(csv.status, 200);
  assert.match(csv.text, /Date,Status,Student/);
  assert.match(csv.text, /'=1\+1, ""x""/);
  assert.equal(csv.text.includes("Other"), false);

  const grades = await request("GET", "/api/reports/grades?academicYear=2026&subject=Math", studentToken);
  assert.equal((grades.body.data?.summary as { averagePercentage?: number }).averagePercentage, 85);
  assert.equal((grades.body.data?.rows as Array<{ grade?: string }>)[0]?.grade, "A");

  const fees = await request("GET", "/api/reports/fees?academicYear=2026", teacherToken);
  const feeSummary = fees.body.data?.summary as { totalAmount?: number; totalPaid?: number; totalPending?: number; partial?: number };
  assert.equal(feeSummary.totalAmount, 100);
  assert.equal(feeSummary.totalPaid, 25);
  assert.equal(feeSummary.totalPending, 75);
  assert.equal(feeSummary.partial, 1);
  const feeRows = fees.body.data?.rows as Array<{ outstanding?: number }>;
  assert.equal(feeRows[0]?.outstanding, 75);
});
