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
import { generateAccessToken } from "../src/utils/jwt.ts";

let mongo: MongoMemoryServer;
let server: http.Server;
let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

async function makeUser(role: "admin" | "user" = "user", name = "Omar") {
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

const studentBody = (userId: string, studentId: string) => ({
  userId,
  studentId,
  firstName: "Omar",
  lastName: "Khan",
  dateOfBirth: "2012-04-01",
  gender: "male",
  parentName: "Parent",
  parentPhone: "0700000000",
});

const teacherBody = (userId: string, teacherId: string) => ({
  userId,
  teacherId,
  firstName: "Omar",
  lastName: "Khan",
  dateOfBirth: "1990-04-01",
  gender: "male",
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

test("administrators can find accounts and link one student or teacher profile", async () => {
  const admin = await makeUser("admin", "Admin");
  const omar = await makeUser("user", "Omar");
  const other = await makeUser("user", "Other");
  const adminToken = tokenFor(admin);
  const userToken = tokenFor(omar);

  const hidden = await request("GET", "/api/users?search=omar", userToken);
  assert.equal(hidden.status, 403);
  const unauthenticated = await request("GET", "/api/users?search=omar");
  assert.equal(unauthenticated.status, 401);

  const directory = await request("GET", `/api/users?search=${omar.username}`, adminToken);
  assert.equal(directory.status, 200);
  const users = directory.body.data?.users as Record<string, unknown>[];
  assert.equal(users.length, 1);
  assert.equal(users[0]?.id, omar._id.toString());
  assert.equal(users[0]?.email, omar.email);
  assert.equal(users[0]?.hasStudentProfile, false);
  assert.equal("password" in (users[0] ?? {}), false);
  assert.equal("tokenVersion" in (users[0] ?? {}), false);

  const shortSearch = await request("GET", "/api/users?search=o", adminToken);
  assert.deepEqual((shortSearch.body.data?.users as unknown[]) ?? [], []);

  const missing = await request("POST", "/api/students", adminToken, studentBody(new mongoose.Types.ObjectId().toString(), "STU-1"));
  assert.equal(missing.status, 404);
  const invalid = await request("POST", "/api/students", adminToken, studentBody("not-an-id", "STU-1"));
  assert.equal(invalid.status, 400);
  const forbidden = await request("POST", "/api/students", userToken, studentBody(omar._id.toString(), "STU-1"));
  assert.equal(forbidden.status, 403);

  const created = await request("POST", "/api/students", adminToken, studentBody(omar._id.toString(), "STU-1"));
  assert.equal(created.status, 201);
  const duplicateUser = await request("POST", "/api/students", adminToken, studentBody(omar._id.toString(), "STU-2"));
  assert.equal(duplicateUser.status, 400);
  const duplicateCode = await request("POST", "/api/students", adminToken, studentBody(other._id.toString(), "STU-1"));
  assert.equal(duplicateCode.status, 400);

  const teacherForbidden = await request("POST", "/api/teachers", userToken, teacherBody(other._id.toString(), "TCH-1"));
  assert.equal(teacherForbidden.status, 403);
  const teacher = await request("POST", "/api/teachers", adminToken, teacherBody(other._id.toString(), "TCH-1"));
  assert.equal(teacher.status, 201);
  const duplicateTeacher = await request("POST", "/api/teachers", adminToken, teacherBody(other._id.toString(), "TCH-2"));
  assert.equal(duplicateTeacher.status, 400);

  const linked = await request("GET", `/api/users?search=${omar.username}`, adminToken);
  const linkedUser = (linked.body.data?.users as Record<string, unknown>[])[0];
  assert.equal(linkedUser?.hasStudentProfile, true);
  assert.equal(await Student.countDocuments({ userId: omar._id }), 1);
  assert.equal(await Teacher.countDocuments({ userId: other._id }), 1);
  const unchanged = await User.findById(omar._id);
  assert.equal(unchanged?.role, "user");
});
