import "./env-setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Class from "../src/models/Class.model.ts";
import Message from "../src/models/Message.model.ts";
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

test("private messages stay with participants and follow school relationships", async () => {
  const admin = await makeUser("admin", "Admin");
  const studentAccount = await makeUser("user", "Omar");
  const teacherAccount = await makeUser("user", "Laila");
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
  await Student.create({
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
  await Class.create({
    name: "Grade 6",
    section: "A",
    grade: "6",
    teacherId: teacher._id,
    students: [student._id],
    capacity: 30,
    academicYear: "2026",
  });

  const studentToken = tokenFor(studentAccount);
  const teacherToken = tokenFor(teacherAccount);
  const outsiderToken = tokenFor(outsiderAccount);
  const guestToken = tokenFor(guest);
  const adminToken = tokenFor(admin);

  assert.equal((await request("GET", "/api/messages/conversations")).status, 401);

  const invalid = await request("POST", "/api/messages", studentToken, {
    receiverId: "not-a-user",
    subject: "Hello",
    content: "Hi",
  });
  assert.equal(invalid.status, 400);

  const missing = await request("POST", "/api/messages", studentToken, {
    receiverId: "64b000000000000000000099",
    subject: "Hello",
    content: "Hi",
  });
  assert.equal(missing.status, 404);

  const self = await request("POST", "/api/messages", studentToken, {
    receiverId: studentAccount._id.toString(),
    subject: "Hello",
    content: "Hi",
  });
  assert.equal(self.status, 400);

  const blocked = await request("POST", "/api/messages", studentToken, {
    receiverId: outsiderAccount._id.toString(),
    subject: "Hello",
    content: "Hi",
  });
  assert.equal(blocked.status, 403);

  const guestBlocked = await request("POST", "/api/messages", guestToken, {
    receiverId: teacherAccount._id.toString(),
    subject: "Hello",
    content: "Hi",
  });
  assert.equal(guestBlocked.status, 403);

  const sent = await request("POST", "/api/messages", teacherToken, {
    receiverId: studentAccount._id.toString(),
    senderId: admin._id.toString(),
    subject: "Homework",
    content: "Please read chapter 1",
  });
  assert.equal(sent.status, 201);
  const messageId = String(sent.body.data?._id ?? "");
  assert.ok(messageId);
  const stored = await Message.findById(messageId);
  assert.equal(stored?.senderId.toString(), teacherAccount._id.toString());

  const again = await request("POST", "/api/messages", studentToken, {
    receiverId: teacherAccount._id.toString(),
    subject: "Reply",
    content: "I will",
  });
  assert.equal(again.status, 201);

  const teacherList = await request("GET", "/api/messages/conversations", teacherToken);
  assert.equal(teacherList.status, 200);
  const conversations = teacherList.body.data?.conversations as Array<{ participant?: { id?: string }; unreadCount?: number }>;
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0]?.participant?.id, studentAccount._id.toString());
  assert.equal(conversations[0]?.unreadCount, 1);

  const outsiderList = await request("GET", "/api/messages/conversations", outsiderToken);
  assert.equal((outsiderList.body.data?.conversations as unknown[]).length, 0);

  const outsiderThread = await request(
    "GET",
    `/api/messages/conversations/${teacherAccount._id.toString()}`,
    outsiderToken,
  );
  assert.equal(outsiderThread.status, 403);

  const hidden = await request("GET", `/api/messages/${messageId}`, studentToken);
  assert.equal(hidden.status, 200);
  const stranger = await request("GET", `/api/messages/${messageId}`, outsiderToken);
  assert.equal(stranger.status, 404);
  assert.equal((await request("GET", "/api/messages/not-an-id", studentToken)).status, 400);

  const thread = await request(
    "GET",
    `/api/messages/conversations/${teacherAccount._id.toString()}`,
    studentToken,
  );
  assert.equal(thread.status, 200);
  const messages = thread.body.data?.messages as Array<{ sender?: { id?: string }; content?: string }>;
  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.sender?.id, teacherAccount._id.toString());
  assert.equal(JSON.stringify(thread.body).includes("password"), false);

  const marked = await request(
    "PATCH",
    `/api/messages/conversations/${teacherAccount._id.toString()}/read`,
    studentToken,
  );
  assert.equal(marked.status, 200);
  assert.equal((await request("GET", "/api/messages/unread-count", studentToken)).body.data?.unreadCount, 0);
  const senderRead = await request("PATCH", `/api/messages/${messageId}/read`, teacherToken);
  assert.equal(senderRead.status, 403);

  const recipients = await request("GET", "/api/messages/recipients", teacherToken);
  const recipientIds = (recipients.body.data?.recipients as Array<{ id?: string }>).map((item) => item.id);
  assert.equal(recipientIds.includes(studentAccount._id.toString()), true);
  assert.equal(recipientIds.includes(outsiderAccount._id.toString()), false);
  assert.deepEqual((await request("GET", "/api/messages/recipients", guestToken)).body.data?.recipients, []);

  const adminSent = await request("POST", "/api/messages", adminToken, {
    receiverId: guest._id.toString(),
    subject: "Welcome",
    content: "Hello",
  });
  assert.equal(adminSent.status, 201);
  const reply = await request("POST", "/api/messages", guestToken, {
    receiverId: admin._id.toString(),
    subject: "Thanks",
    content: "Received",
  });
  assert.equal(reply.status, 201);
  const adminInbox = await request("GET", "/api/messages/inbox", outsiderToken);
  assert.equal((adminInbox.body.data?.messages as unknown[]).length, 0);
});
