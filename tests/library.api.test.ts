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

test("library catalog and loans follow school access", async () => {
  const admin = await makeUser("admin", "Admin");
  const account = await makeUser("user", "Omar");
  const teacherAccount = await makeUser("user", "Teacher");
  const outsider = await makeUser("user", "Outsider");
  const unscoped = await makeUser("user", "Guest");
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
  await Student.create({
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
    firstName: "Laila",
    lastName: "Noori",
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
  const anonymous = await request("GET", "/api/library/books");
  assert.equal(anonymous.status, 401);
  const hidden = await request("GET", "/api/library/books", tokenFor(unscoped));
  assert.equal(hidden.status, 403);
  const hiddenLoans = await request("GET", "/api/library/borrows", tokenFor(unscoped));
  assert.equal(hiddenLoans.status, 403);

  const created = await request("POST", "/api/library/books", adminToken, {
    title: "Algebra",
    author: "Noori",
    isbn: nextId("ISBN"),
    category: "Mathematics",
    totalCopies: 1,
    availableCopies: 1,
  });
  assert.equal(created.status, 201);
  const bookId = String(created.body.data?._id);
  const studentRead = await request("GET", "/api/library/books", tokenFor(account));
  assert.equal(studentRead.status, 200);
  const studentDetail = await request("GET", `/api/library/books/${bookId}`, tokenFor(account));
  assert.equal(studentDetail.status, 200);
  const badId = await request("GET", "/api/library/books/not-an-id", adminToken);
  assert.equal(badId.status, 400);
  const studentCreate = await request("POST", "/api/library/books", tokenFor(account), {
    title: "Blocked",
    author: "Blocked",
    category: "Other",
    totalCopies: 1,
    availableCopies: 1,
  });
  assert.equal(studentCreate.status, 403);

  const missingBorrower = await request("POST", `/api/library/books/${bookId}/borrow`, adminToken, {
    borrowerId: new mongoose.Types.ObjectId().toString(),
    borrowerType: "student",
    dueDate: "2026-12-01",
  });
  assert.equal(missingBorrower.status, 404);
  const borrowed = await request("POST", `/api/library/books/${bookId}/borrow`, adminToken, {
    borrowerId: student._id.toString(),
    borrowerType: "student",
    dueDate: "2026-12-01",
  });
  assert.equal(borrowed.status, 201);
  const borrowId = String(borrowed.body.data?._id);
  const unavailable = await request("POST", `/api/library/books/${bookId}/borrow`, adminToken, {
    borrowerId: teacher._id.toString(),
    borrowerType: "teacher",
    dueDate: "2026-12-01",
  });
  assert.equal(unavailable.status, 400);

  const ownLoans = await request("GET", "/api/library/borrows", tokenFor(account));
  assert.equal(ownLoans.status, 200);
  const ownRows = (ownLoans.body.data?.borrows as Record<string, unknown>[] | undefined) ?? [];
  assert.equal(ownRows.length, 1);
  const borrower = ownRows[0]?.borrowerId as { firstName?: string; studentId?: string };
  assert.equal(borrower.firstName, "Omar");
  assert.equal(JSON.stringify(ownLoans.body).includes("password"), false);

  const otherLoans = await request(
    "GET",
    `/api/library/borrows?borrowerId=${student._id.toString()}`,
    tokenFor(outsider),
  );
  assert.equal(otherLoans.status, 403);
  const teacherLoans = await request("GET", "/api/library/borrows", tokenFor(teacherAccount));
  assert.equal(teacherLoans.status, 200);
  assert.equal(((teacherLoans.body.data?.borrows as unknown[]) ?? []).length, 1);
  const teacherBorrow = await request("POST", `/api/library/books/${bookId}/borrow`, tokenFor(teacherAccount), {
    borrowerId: student._id.toString(),
    borrowerType: "student",
    dueDate: "2026-12-01",
  });
  assert.equal(teacherBorrow.status, 403);

  const returned = await request("PATCH", `/api/library/borrows/${borrowId}/return`, adminToken, {});
  assert.equal(returned.status, 200);
  assert.equal(returned.body.data?.status, "returned");
  const again = await request("PATCH", `/api/library/borrows/${borrowId}/return`, adminToken, {});
  assert.equal(again.status, 400);
  const restored = await request("GET", `/api/library/books/${bookId}`, adminToken);
  assert.equal(restored.body.data?.availableCopies, 1);
  assert.equal(restored.body.data?.status, "available");
});
