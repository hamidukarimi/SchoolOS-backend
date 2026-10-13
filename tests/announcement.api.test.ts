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
import Announcement from "../src/models/Announcement.model.ts";
import { generateAccessToken } from "../src/utils/jwt.ts";

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
): Promise<{ status: number; body: { success?: boolean; message?: string; data?: Record<string, unknown> } }> {
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

function titles(response: { body: { data?: Record<string, unknown> } }): string[] {
  const announcements = response.body.data?.announcements as { title: string }[] | undefined;
  return (announcements ?? []).map((item) => item.title);
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

test("announcement reads follow audience, class, and publication rules", async () => {
  const admin = await makeUser("admin");
  const teacherUser = await makeUser();
  const studentUser = await makeUser();
  const otherStudentUser = await makeUser();
  const bothUser = await makeUser();
  const unscoped = await makeUser();
  const teacher = await makeTeacher(teacherUser._id);
  const student = await makeStudent(studentUser._id);
  const otherStudent = await makeStudent(otherStudentUser._id);
  await makeTeacher(bothUser._id);
  await makeStudent(bothUser._id);
  const schoolClass = await Class.create({
    name: "Grade 6",
    section: "A",
    grade: "6",
    teacherId: teacher._id,
    students: [student._id],
    capacity: 30,
    academicYear: "2026-2027",
  });
  const adminToken = tokenFor(admin);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const created = await request("POST", "/api/announcements", adminToken, {
    title: "School closed",
    content: "Friday is a holiday.",
    audience: "all",
    publishedBy: otherStudentUser._id.toString(),
  });
  assert.equal(created.status, 201);
  const saved = await Announcement.findById((created.body.data as { _id: string })._id);
  assert.equal(saved?.publishedBy.toString(), admin._id.toString());

  await Announcement.create({
    title: "Staff meeting",
    content: "Teachers meet at noon.",
    audience: "teachers",
    publishedBy: admin._id,
  });
  await Announcement.create({
    title: "Homework",
    content: "Read chapter 2.",
    audience: "students",
    publishedBy: admin._id,
  });
  await Announcement.create({
    title: "Parent evening",
    content: "Parents are invited.",
    audience: "parents",
    publishedBy: admin._id,
  });
  await Announcement.create({
    title: "Grade 6 trip",
    content: "Bring a packed lunch.",
    audience: "all",
    classId: schoolClass._id,
    publishedBy: admin._id,
  });
  await Announcement.create({
    title: "Draft notice",
    content: "Not ready.",
    audience: "all",
    isPublished: false,
    publishedBy: admin._id,
  });
  await Announcement.create({
    title: "Expired notice",
    content: "This already ended.",
    audience: "all",
    expiryDate: yesterday,
    publishedBy: admin._id,
  });
  await Announcement.create({
    title: "Future notice",
    content: "This is scheduled.",
    audience: "all",
    publishDate: tomorrow,
    publishedBy: admin._id,
  });

  const unauthenticated = await request("GET", "/api/announcements");
  assert.equal(unauthenticated.status, 401);

  const teacherList = titles(await request("GET", "/api/announcements", tokenFor(teacherUser)));
  assert.deepEqual(teacherList.sort(), ["Grade 6 trip", "School closed", "Staff meeting"]);
  const studentList = titles(await request("GET", "/api/announcements", tokenFor(studentUser)));
  assert.deepEqual(studentList.sort(), ["Grade 6 trip", "Homework", "School closed"]);
  const otherStudentList = titles(await request("GET", "/api/announcements", tokenFor(otherStudentUser)));
  assert.deepEqual(otherStudentList.sort(), ["Homework", "School closed"]);
  const unscopedList = titles(await request("GET", "/api/announcements", tokenFor(unscoped)));
  assert.deepEqual(unscopedList, ["School closed"]);
  const bothList = titles(await request("GET", "/api/announcements", tokenFor(bothUser)));
  assert.equal(bothList.includes("Homework"), false);
  assert.equal(bothList.includes("Staff meeting"), true);

  const adminList = titles(await request("GET", "/api/announcements", adminToken));
  assert.equal(adminList.includes("Parent evening"), true);
  assert.equal(adminList.includes("Draft notice"), true);
  assert.equal(adminList.includes("Expired notice"), true);

  const hiddenDraft = await request("GET", "/api/announcements?isPublished=false", tokenFor(studentUser));
  assert.equal(titles(hiddenDraft).includes("Draft notice"), false);
  const forcedTeachers = await request("GET", "/api/announcements?audience=teachers", tokenFor(studentUser));
  assert.deepEqual(titles(forcedTeachers), []);

  const staff = await Announcement.findOne({ title: "Staff meeting" });
  const missing = await request("GET", `/api/announcements/${new mongoose.Types.ObjectId().toString()}`, tokenFor(studentUser));
  const forbidden = await request("GET", `/api/announcements/${staff?._id.toString()}`, tokenFor(studentUser));
  assert.equal(missing.status, 404);
  assert.equal(forbidden.status, 404);
  assert.equal(forbidden.body.message, "Announcement not found");
  assert.equal(missing.body.message, forbidden.body.message);

  const teacherWrite = await request("POST", "/api/announcements", tokenFor(teacherUser), {
    title: "Not allowed",
    content: "A teacher cannot post this.",
  });
  assert.equal(teacherWrite.status, 403);

  const updated = await request("PUT", `/api/announcements/${saved?._id.toString()}`, adminToken, {
    title: "School closed Friday",
  });
  assert.equal(updated.status, 200);
  const removed = await request("DELETE", `/api/announcements/${saved?._id.toString()}`, adminToken);
  assert.equal(removed.status, 200);
  assert.equal(await Announcement.countDocuments({ _id: saved?._id }), 0);
});
