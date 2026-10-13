import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { announcementReadQuery, audiencesFor } from "../src/utils/announcementAccess.ts";

const classId = new mongoose.Types.ObjectId();

test("audiences follow the signed-in persona and never grant parent access by default", () => {
  assert.deepEqual(audiencesFor({ kind: "admin" }), ["all", "teachers", "students", "parents"]);
  assert.deepEqual(
    audiencesFor({
      kind: "teacher",
      teacherDocId: new mongoose.Types.ObjectId(),
      rosterStudentIds: [],
      taughtClassIds: [],
    }),
    ["all", "teachers"],
  );
  assert.deepEqual(
    audiencesFor({
      kind: "student",
      studentDocId: new mongoose.Types.ObjectId(),
      classIds: [],
    }),
    ["all", "students"],
  );
  assert.deepEqual(audiencesFor({ kind: "none" }), ["all"]);
});

test("a student cannot request teacher announcements", () => {
  const query = announcementReadQuery(
    { kind: "student", studentDocId: new mongoose.Types.ObjectId(), classIds: [classId] },
    { audience: "teachers" },
  );
  assert.deepEqual(query, { _id: { $in: [] } });
});

test("an unscoped account cannot filter by a class", () => {
  assert.throws(
    () => announcementReadQuery({ kind: "none" }, { classId: classId.toString() }),
    /access to this class/,
  );
});
