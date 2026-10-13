import "./env-setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Class from "../src/models/Class.model.ts";
import Student from "../src/models/Student.model.ts";
import Teacher from "../src/models/Teacher.model.ts";
import User from "../src/models/User.model.ts";
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
  path: string,
  token?: string,
): Promise<{ status: number; body: { message?: string; data?: { classes?: Record<string, unknown>[] } } }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as AddressInfo;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path,
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : {} });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function makeStudent(userId: mongoose.Types.ObjectId, studentId: string) {
  return Student.create({
    userId,
    studentId,
    firstName: "Omar",
    lastName: "Khan",
    dateOfBirth: new Date("2012-04-01"),
    gender: "male",
    parentName: "Parent",
    parentPhone: "0700000000",
  });
}

async function makeTeacher(userId: mongoose.Types.ObjectId, teacherId: string) {
  return Teacher.create({
    userId,
    teacherId,
    firstName: "Teacher",
    lastName: "Khan",
    dateOfBirth: new Date("1990-01-01"),
    gender: "female",
  });
}

async function makeClass(input: {
  name: string;
  section: string;
  teacherId?: mongoose.Types.ObjectId;
  students: mongoose.Types.ObjectId[];
}) {
  return Class.create({
    name: input.name,
    section: input.section,
    grade: "6",
    ...(input.teacherId ? { teacherId: input.teacherId } : {}),
    students: input.students,
    capacity: 30,
    academicYear: "2026",
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

test("enrolled classes come from the class roster when classId is empty or stale", async () => {
  const admin = await makeUser("admin", "Admin");
  const account = await makeUser("user", "Omar");
  const teacherAccount = await makeUser("user", "Teacher");
  const outsider = await makeUser("user", "Outsider");
  const student = await makeStudent(account._id, nextId("STU"));
  const other = await makeStudent(outsider._id, nextId("STU"));
  const teacher = await makeTeacher(teacherAccount._id, nextId("TCH"));
  const otherTeacher = await makeTeacher((await makeUser("user", "Other"))._id, nextId("TCH"));
  const gradeSix = await makeClass({
    name: "Grade 6",
    section: "A",
    teacherId: teacher._id,
    students: [student._id],
  });
  const science = await makeClass({
    name: "Science",
    section: "B",
    teacherId: otherTeacher._id,
    students: [student._id],
  });
  const history = await makeClass({
    name: "History",
    section: "C",
    students: [other._id],
  });
  await Student.updateOne({ _id: student._id }, { classId: history._id });

  const adminResult = await request(`/api/students/${student._id.toString()}/classes`, tokenFor(admin));
  assert.equal(adminResult.status, 200);
  const names = (adminResult.body.data?.classes ?? []).map((item) => item.name);
  assert.deepEqual(names, ["Grade 6", "Science"]);
  const first = adminResult.body.data?.classes?.[0];
  assert.equal(first?.section, "A");
  assert.equal(first?.grade, "6");
  assert.equal(first?.academicYear, "2026");
  assert.equal((first?.teacher as { id?: string } | null)?.id, teacher._id.toString());
  assert.equal("students" in (first ?? {}), false);
  assert.equal(JSON.stringify(adminResult.body).includes("password"), false);
  assert.equal(names.includes("History"), false);
  const stored = await Student.findById(student._id).select("classId");
  assert.equal(stored?.classId?.toString(), history._id.toString());
  assert.equal(science.students.length, 1);

  const own = await request(`/api/students/${student._id.toString()}/classes`, tokenFor(account));
  assert.equal(own.status, 200);
  assert.equal(own.body.data?.classes?.length, 2);

  const teacherView = await request(`/api/students/${student._id.toString()}/classes`, tokenFor(teacherAccount));
  assert.equal(teacherView.status, 200);
  assert.equal(teacherView.body.data?.classes?.length, 2);

  const unenrolled = await makeStudent((await makeUser("user", "New"))._id, nextId("STU"));
  const empty = await request(`/api/students/${unenrolled._id.toString()}/classes`, tokenFor(admin));
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.data?.classes, []);
});

test("another student cannot read someone else's enrolled classes", async () => {
  const account = await makeUser("user", "Omar");
  const outsider = await makeUser("user", "Outsider");
  const student = await makeStudent(account._id, nextId("STU"));
  await makeStudent(outsider._id, nextId("STU"));
  await makeClass({ name: "Grade 6", section: "A", students: [student._id] });

  const denied = await request(`/api/students/${student._id.toString()}/classes`, tokenFor(outsider));
  assert.equal(denied.status, 403);

  const unscoped = await request(`/api/students/${student._id.toString()}/classes`, tokenFor(await makeUser()));
  assert.equal(unscoped.status, 403);

  const missingTeacher = await makeUser("user", "Teacher");
  await makeTeacher(missingTeacher._id, nextId("TCH"));
  const outsideRoster = await request(`/api/students/${student._id.toString()}/classes`, tokenFor(missingTeacher));
  assert.equal(outsideRoster.status, 403);

  const invalid = await request("/api/students/not-an-id/classes", tokenFor(await makeUser("admin", "Admin")));
  assert.equal(invalid.status, 400);

  const missing = await request(`/api/students/${new mongoose.Types.ObjectId().toString()}/classes`, tokenFor(await makeUser("admin", "Admin2")));
  assert.equal(missing.status, 404);
});
