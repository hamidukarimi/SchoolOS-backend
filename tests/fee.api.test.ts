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
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; body: { message?: string; data?: Record<string, unknown> } }> {
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
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
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
    if (payload) req.write(payload);
    req.end();
  });
}

const feeBody = (studentId: string, amount = 100) => ({
  studentId,
  title: "Tuition",
  amount,
  dueDate: "2026-11-01",
  academicYear: "2026",
  term: "1",
});

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

test("administrators record fees and payments for an existing student", async () => {
  const admin = await makeUser("admin", "Admin");
  const account = await makeUser("user", "Omar");
  const teacherAccount = await makeUser("user", "Teacher");
  const outsider = await makeUser("user", "Outsider");
  const student = await Student.create({
    userId: account._id,
    studentId: nextId("STU"),
    firstName: "Omar",
    lastName: "Khan",
    dateOfBirth: new Date("2012-04-01"),
    gender: "male",
    parentName: "Parent",
    parentPhone: "0700000000",
  });
  const other = await Student.create({
    userId: outsider._id,
    studentId: nextId("STU"),
    firstName: "Other",
    lastName: "Khan",
    dateOfBirth: new Date("2012-04-01"),
    gender: "female",
    parentName: "Parent",
    parentPhone: "0700000001",
  });
  const teacher = await Teacher.create({
    userId: teacherAccount._id,
    teacherId: nextId("TCH"),
    firstName: "Teacher",
    lastName: "Khan",
    dateOfBirth: new Date("1990-01-01"),
    gender: "female",
  });
  await Class.create({
    name: "Grade 6",
    section: "A",
    grade: "6",
    teacherId: teacher._id,
    students: [student._id],
    capacity: 30,
    academicYear: "2026",
  });
  const adminToken = tokenFor(admin);
  const studentId = student._id.toString();

  const invalid = await request("POST", "/api/fees", adminToken, feeBody("not-an-id"));
  assert.equal(invalid.status, 400);

  const missingStudent = await request("POST", "/api/fees", adminToken, feeBody(new mongoose.Types.ObjectId().toString()));
  assert.equal(missingStudent.status, 404);

  const created = await request("POST", "/api/fees", adminToken, feeBody(studentId, 100));
  assert.equal(created.status, 201);
  const feeId = String((created.body.data as { _id?: string } | undefined)?._id);
  assert.match(feeId, /^[a-f\d]{24}$/i);

  const deniedCreate = await request("POST", "/api/fees", tokenFor(account), feeBody(studentId));
  assert.equal(deniedCreate.status, 403);

  const listed = await request("GET", "/api/fees", adminToken);
  assert.equal(listed.status, 200);
  const fees = (listed.body.data as { fees?: unknown[] } | undefined)?.fees ?? [];
  assert.equal(fees.length, 1);

  const teacherList = await request("GET", "/api/fees", tokenFor(teacherAccount));
  assert.equal(teacherList.status, 200);
  assert.equal(((teacherList.body.data as { fees?: unknown[] }).fees ?? []).length, 1);
  const teacherCreate = await request("POST", "/api/fees", tokenFor(teacherAccount), feeBody(studentId));
  assert.equal(teacherCreate.status, 403);

  const ownList = await request("GET", "/api/fees", tokenFor(account));
  assert.equal(ownList.status, 200);
  const otherList = await request("GET", `/api/fees/${feeId}`, tokenFor(outsider));
  assert.equal(otherList.status, 403);
  const unscoped = await request("GET", "/api/fees", tokenFor(await makeUser()));
  assert.equal(unscoped.status, 403);

  const summary = await request("GET", `/api/fees/summary/${studentId}`, tokenFor(account));
  assert.equal(summary.status, 200);
  assert.equal(summary.body.data?.totalAmount, 100);
  assert.equal(summary.body.data?.totalPaid, 0);
  const otherSummary = await request("GET", `/api/fees/summary/${studentId}`, tokenFor(outsider));
  assert.equal(otherSummary.status, 403);
  const badSummary = await request("GET", "/api/fees/summary/not-an-id", adminToken);
  assert.equal(badSummary.status, 400);

  const partial = await request("POST", `/api/fees/${feeId}/payment`, adminToken, { paidAmount: 40 });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.data?.paidAmount, 40);
  assert.equal(partial.body.data?.status, "partial");

  const capped = await request("POST", `/api/fees/${feeId}/payment`, adminToken, { paidAmount: 150 });
  assert.equal(capped.status, 200);
  assert.equal(capped.body.data?.paidAmount, 100);
  assert.equal(capped.body.data?.status, "paid");

  const again = await request("POST", `/api/fees/${feeId}/payment`, adminToken, { paidAmount: 10 });
  assert.equal(again.status, 400);
  const badFee = await request("GET", "/api/fees/not-an-id", adminToken);
  assert.equal(badFee.status, 400);
  assert.equal(other._id.toString().length, 24);
});
