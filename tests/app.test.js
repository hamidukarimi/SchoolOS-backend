import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "../dist/app.js";
import {
  clearRefreshCookieOptions,
  refreshCookieOptions,
} from "../dist/config/cookie.js";

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Unable to resolve test server address");
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

test("GET /api/health returns a safe health response", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "NovaSchool OS API is running");
  assert.equal(body.environment, "development");
  assert.ok(Date.parse(body.timestamp));
  assert.equal("mongoUri" in body, false);
});

test("CORS allows the configured Angular origin and credentials", async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "http://127.0.0.1:4200" },
  });

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "http://127.0.0.1:4200",
  );
  assert.equal(
    response.headers.get("access-control-allow-credentials"),
    "true",
  );
});

test("local refresh cookies are HTTP-only and compatible with local HTTP", () => {
  const cookie = refreshCookieOptions();
  const clearCookie = clearRefreshCookieOptions();

  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, false);
  assert.equal(cookie.sameSite, "lax");
  assert.equal(cookie.path, "/api");
  assert.ok(cookie.maxAge > 0);
  assert.deepEqual(clearCookie, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/api",
  });
});

test("CORS rejects an origin that is not configured", async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "https://example.invalid" },
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(body.message, "Origin not allowed by CORS");
});

test("request validation returns a structured 400 response", async () => {
  const response = await fetch(`${baseUrl}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:4200",
    },
    body: JSON.stringify({ email: "invalid", password: "short" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, "Validation error");
  assert.ok(Array.isArray(body.errors));
});

test("unknown routes return JSON", async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.match(body.message, /Route GET .* not found/);
});
