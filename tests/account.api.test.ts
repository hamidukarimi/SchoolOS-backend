import "./env-setup.ts";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Staff from "../src/models/Staff.model.ts";
import Student from "../src/models/Student.model.ts";
import User from "../src/models/User.model.ts";
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
  cookie?: string,
): Promise<{
  status: number;
  body: { message?: string; data?: Record<string, unknown>; errors?: string[] };
  setCookie: string[];
}> {
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
          ...(cookie ? { Cookie: cookie } : {}),
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          const rawCookie = res.headers["set-cookie"];
          let body: { message?: string; data?: Record<string, unknown>; errors?: string[] } = {};
          if (text) {
            try {
              body = JSON.parse(text) as typeof body;
            } catch {
              body = { message: text };
            }
          }
          resolve({
            status: res.statusCode ?? 0,
            body,
            setCookie: rawCookie ? (Array.isArray(rawCookie) ? rawCookie : [rawCookie]) : [],
          });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function cookieFrom(setCookie: string[]): string {
  return setCookie.map((value) => value.split(";")[0]).join("; ");
}

function assertNoSecrets(body: unknown): void {
  const text = JSON.stringify(body);
  assert.equal(text.includes("password"), false);
  assert.equal(text.includes("tokenVersion"), false);
  assert.equal(text.includes("passwordResetToken"), false);
  assert.equal(text.includes("emailVerificationToken"), false);
  assert.equal(text.includes("$2"), false);
}

function accountBody(username: string, email: string, role: "user" | "admin" = "user") {
  return {
    firstname: "Laila",
    lastname: "Noori",
    username,
    email,
    password: "password1",
    role,
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

test("account management is administrator-only and does not return secrets", async () => {
  const admin = await makeUser("admin", "Admin");
  const member = await makeUser("user", "Omar");
  const adminToken = tokenFor(admin);
  const userToken = tokenFor(member);

  const anonymous = await request("GET", "/api/admin/users");
  assert.equal(anonymous.status, 401);

  const denied = await request("GET", "/api/admin/users", userToken);
  assert.equal(denied.status, 403);

  const deniedCreate = await request("POST", "/api/admin/users", userToken, accountBody("laila", "laila@example.com"));
  assert.equal(deniedCreate.status, 403);

  const escalated = await request("POST", "/api/users", undefined, {
    ...accountBody("newperson", "new@example.com", "admin"),
  });
  assert.equal(escalated.status, 400);
  assert.equal(await User.countDocuments({ email: "new@example.com" }), 0);

  const profile = await request("PUT", "/api/users/me", userToken, { firstname: "Omar", role: "admin" });
  assert.equal(profile.status, 200);
  assert.equal((profile.body.data?.user as { role?: string } | undefined)?.role, "user");
  assert.equal((await User.findById(member._id))?.role, "user");

  const created = await request("POST", "/api/admin/users", adminToken, accountBody("laila", "laila@example.com"));
  assert.equal(created.status, 201);
  assert.equal(created.body.data?.accessToken, undefined);
  assertNoSecrets(created.body);
  const account = created.body.data?.account as { id?: string; role?: string; hasStudentProfile?: boolean };
  assert.equal(account.role, "user");
  assert.equal(account.hasStudentProfile, false);
  const stored = await User.findById(account.id).select("+password");
  assert.ok(stored);
  assert.notEqual(stored.password, "password1");
  assert.match(stored.password, /^\$2/);

  const duplicateEmail = await request("POST", "/api/admin/users", adminToken, accountBody("other", "laila@example.com"));
  assert.equal(duplicateEmail.status, 400);
  assert.equal(duplicateEmail.body.message, "Email already registered");

  const duplicateUsername = await request(
    "POST",
    "/api/admin/users",
    adminToken,
    accountBody("laila", "other@example.com"),
  );
  assert.equal(duplicateUsername.status, 409);
  assert.equal(duplicateUsername.body.message, "Username already taken");

  const invalidRole = await request("GET", "/api/admin/users?role=teacher", adminToken);
  assert.equal(invalidRole.status, 400);

  const invalidId = await request("GET", "/api/admin/users/not-an-id", adminToken);
  assert.equal(invalidId.status, 400);

  const missing = await request("GET", "/api/admin/users/64b000000000000000000099", adminToken);
  assert.equal(missing.status, 404);
  assert.equal(missing.body.message, "Account not found");

  const removed = await request("DELETE", `/api/admin/users/${account.id}`, adminToken);
  assert.equal(removed.status, 404);
  assert.equal(await User.countDocuments({ email: "laila@example.com" }), 1);
});

test("account updates keep the last administrator and linked school records", async () => {
  const admin = await makeUser("admin", "Admin");
  const second = await makeUser("admin", "Second");
  const adminToken = tokenFor(admin);

  const created = await request("POST", "/api/admin/users", adminToken, accountBody("laila", "laila@example.com"));
  const accountId = String((created.body.data?.account as { id: string }).id);
  const linkedUser = await User.findById(accountId);
  assert.ok(linkedUser);

  await Student.create({
    userId: linkedUser._id,
    studentId: nextId("STU"),
    firstName: "Laila",
    lastName: "Noori",
    dateOfBirth: new Date("2010-01-02"),
    gender: "female",
    parentName: "Parent",
    parentPhone: "0700000000",
  });
  await Staff.create({
    userId: linkedUser._id,
    staffId: nextId("STF"),
    firstName: "Laila",
    lastName: "Noori",
    dateOfBirth: new Date("1992-03-04"),
    gender: "female",
    department: "Office",
    position: "Registrar",
    salary: 1000,
  });

  const listed = await request("GET", "/api/admin/users?search=laila", adminToken);
  assert.equal(listed.status, 200);
  const rows = listed.body.data?.accounts as Array<{ id: string; hasStudentProfile: boolean; hasStaffRecord: boolean }>;
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.hasStudentProfile, true);
  assert.equal(rows[0]?.hasStaffRecord, true);
  assertNoSecrets(listed.body);

  const deniedUpdate = await request("PATCH", `/api/admin/users/${accountId}`, tokenFor(linkedUser), { role: "admin" });
  assert.equal(deniedUpdate.status, 403);
  assert.equal((await User.findById(accountId))?.role, "user");

  const promoted = await request("PATCH", `/api/admin/users/${accountId}`, adminToken, {
    role: "admin",
    firstname: "Layla",
  });
  assert.equal(promoted.status, 200);
  assert.equal((promoted.body.data?.account as { role?: string }).role, "admin");
  assertNoSecrets(promoted.body);

  const selfDemotion = await request("PATCH", `/api/admin/users/${admin._id.toString()}`, adminToken, { role: "user" });
  assert.equal(selfDemotion.status, 400);
  assert.equal(selfDemotion.body.message, "You cannot remove your own administrator access.");
  assert.equal((await User.findById(admin._id))?.role, "admin");

  const ownPassword = await request("PATCH", `/api/admin/users/${admin._id.toString()}`, adminToken, {
    password: "newpass1",
  });
  assert.equal(ownPassword.status, 400);
  assert.equal(ownPassword.body.message, "Use the password page to change your own password.");

  const demoteSecond = await request("PATCH", `/api/admin/users/${second._id.toString()}`, adminToken, { role: "user" });
  assert.equal(demoteSecond.status, 200);
  const demotePromoted = await request("PATCH", `/api/admin/users/${accountId}`, adminToken, { role: "user" });
  assert.equal(demotePromoted.status, 200);

  const lastAdmin = await request("PATCH", `/api/admin/users/${admin._id.toString()}`, adminToken, { isActive: false });
  assert.equal(lastAdmin.status, 400);
  assert.equal(lastAdmin.body.message, "The last active administrator account cannot be changed.");
  assert.equal((await User.findById(admin._id))?.isActive, true);

  const deactivated = await request("PATCH", `/api/admin/users/${accountId}`, adminToken, { isActive: false });
  assert.equal(deactivated.status, 200);
  assert.equal((deactivated.body.data?.account as { isActive?: boolean; hasStudentProfile?: boolean }).isActive, false);
  assert.equal((deactivated.body.data?.account as { hasStudentProfile?: boolean }).hasStudentProfile, true);
  assert.equal(await Student.countDocuments({ userId: linkedUser._id }), 1);
  assert.equal(await Staff.countDocuments({ userId: linkedUser._id }), 1);

  const oldToken = tokenFor(linkedUser);
  const blocked = await request("GET", "/api/users/me", oldToken);
  assert.equal(blocked.status, 401);

  const login = await request("POST", "/api/sessions", undefined, { email: "laila@example.com", password: "password1" });
  assert.equal(login.status, 403);
  assert.equal(login.body.message, "Account is deactivated.");

  const reactivated = await request("PATCH", `/api/admin/users/${accountId}`, adminToken, {
    isActive: true,
    password: "newpass1",
  });
  assert.equal(reactivated.status, 200);
  assertNoSecrets(reactivated.body);
  const oldLogin = await request("POST", "/api/sessions", undefined, {
    email: "laila@example.com",
    password: "password1",
  });
  assert.equal(oldLogin.status, 401);
  const newLogin = await request("POST", "/api/sessions", undefined, {
    email: "laila@example.com",
    password: "newpass1",
  });
  assert.equal(newLogin.status, 200);
  assert.equal(await Student.countDocuments({ userId: linkedUser._id }), 1);
  assert.equal(await Staff.countDocuments({ userId: linkedUser._id }), 1);
});

test("a deactivated account cannot refresh an existing session", async () => {
  const admin = await makeUser("admin", "Admin");
  const created = await request(
    "POST",
    "/api/admin/users",
    tokenFor(admin),
    accountBody("laila", "laila@example.com"),
  );
  const login = await request("POST", "/api/sessions", undefined, { email: "laila@example.com", password: "password1" });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login.setCookie);
  assert.ok(cookie);

  await User.updateOne({ email: "laila@example.com" }, { isActive: false });
  const refreshed = await request("POST", "/api/token", undefined, undefined, cookie);
  assert.equal(refreshed.status, 403);
  assert.equal(refreshed.body.message, "Account is deactivated.");
  assert.equal(refreshed.body.data, undefined);
});
