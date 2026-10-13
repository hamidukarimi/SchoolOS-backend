import "./env-setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "../src/models/User.model.ts";
import Staff from "../src/models/Staff.model.ts";
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
): Promise<{ status: number; body: { message?: string; data?: Record<string, unknown>; errors?: string[] } }> {
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

function staffBody(userId: string, staffId: string) {
  return {
    userId,
    staffId,
    firstName: "Laila",
    lastName: "Noori",
    dateOfBirth: "1992-03-04",
    gender: "female",
    department: "Office",
    position: "Registrar",
    salary: 1200,
    contractType: "full-time",
    status: "active",
  };
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

test("staff records stay administrator-only and require a real user account", async () => {
  const admin = await makeUser("admin", "Admin");
  const laila = await makeUser("user", "Laila");
  const adminToken = tokenFor(admin);
  const userToken = tokenFor(laila);

  const anonymous = await request("GET", "/api/hr");
  assert.equal(anonymous.status, 401);

  const denied = await request("GET", "/api/hr", userToken);
  assert.equal(denied.status, 403);

  const deniedSummary = await request("GET", "/api/hr/summary", userToken);
  assert.equal(deniedSummary.status, 403);

  const invalidUser = await request("POST", "/api/hr", adminToken, staffBody("not-a-user", "STF-1"));
  assert.equal(invalidUser.status, 400);
  assert.equal(invalidUser.body.message, "Validation error");

  const missingUser = await request(
    "POST",
    "/api/hr",
    adminToken,
    staffBody("64b000000000000000000099", "STF-1"),
  );
  assert.equal(missingUser.status, 404);
  assert.equal(missingUser.body.message, "User account not found");

  const created = await request("POST", "/api/hr", adminToken, staffBody(laila._id.toString(), "STF-1"));
  assert.equal(created.status, 201);
  const staffId = String(created.body.data?._id ?? created.body.data?.id ?? "");
  assert.ok(staffId);

  const linked = await User.findById(laila._id);
  assert.equal(linked?.role, "user");

  const duplicate = await request("POST", "/api/hr", adminToken, staffBody(laila._id.toString(), "STF-2"));
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.message, "Staff with this ID or user already exists");

  const list = await request("GET", "/api/hr?search=Laila", adminToken);
  assert.equal(list.status, 200);
  const listed = list.body.data?.staff as Array<{ staffId?: string; userId?: { email?: string } }>;
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.staffId, "STF-1");
  assert.equal(listed[0]?.userId?.email, laila.email);
  assert.equal(JSON.stringify(list.body).includes("password"), false);

  const summary = await request("GET", "/api/hr/summary", adminToken);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.data?.total, 1);
  assert.equal((summary.body.data?.byStatus as { active?: number } | undefined)?.active, 1);
  assert.equal((summary.body.data?.byContractType as { fullTime?: number } | undefined)?.fullTime, 1);
  assert.equal(summary.body.data?.totalMonthlySalary, 1200);

  const badId = await request("GET", "/api/hr/not-an-id", adminToken);
  assert.equal(badId.status, 400);
  assert.equal(badId.body.message, "A valid id is required");

  const missing = await request("GET", `/api/hr/${new mongoose.Types.ObjectId().toString()}`, adminToken);
  assert.equal(missing.status, 404);

  const removed = await request("DELETE", `/api/hr/${staffId}`, adminToken);
  assert.equal(removed.status, 200);
  assert.equal(await Staff.findById(staffId), null);
  assert.ok(await User.findById(laila._id));
});
