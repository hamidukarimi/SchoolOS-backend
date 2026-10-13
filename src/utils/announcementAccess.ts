import type { SchoolReadScope } from "../types/schoolReadScope.js";
import ApiError from "./ApiError.js";
import { idInObjectIdList } from "./schoolReadAccess.js";

export const ANNOUNCEMENT_AUDIENCES = ["all", "teachers", "students", "parents"] as const;

export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export function audiencesFor(scope: SchoolReadScope): AnnouncementAudience[] {
  switch (scope.kind) {
    case "admin":
      return ["all", "teachers", "students", "parents"];
    case "teacher":
      return ["all", "teachers"];
    case "student":
      return ["all", "students"];
    case "none":
      return ["all"];
  }
}

export function announcementReadQuery(
  scope: SchoolReadScope,
  filters: { audience?: AnnouncementAudience; classId?: string; isPublished?: boolean },
  now = new Date(),
): Record<string, unknown> {
  if (filters.classId) {
    if (scope.kind === "none") {
      throw new ApiError(403, "You do not have access to this class.");
    }
    if (scope.kind === "teacher" && !idInObjectIdList(filters.classId, scope.taughtClassIds)) {
      throw new ApiError(403, "You do not have access to this class.");
    }
    if (scope.kind === "student" && !idInObjectIdList(filters.classId, scope.classIds)) {
      throw new ApiError(403, "You do not have access to this class.");
    }
  }

  const allowed = audiencesFor(scope);
  if (filters.audience && !allowed.includes(filters.audience)) {
    return { _id: { $in: [] } };
  }

  const clauses: Record<string, unknown>[] = [
    { audience: { $in: filters.audience ? [filters.audience] : allowed } },
  ];

  if (scope.kind === "admin") {
    if (filters.isPublished !== undefined) clauses.push({ isPublished: filters.isPublished });
    if (filters.classId) clauses.push({ classId: filters.classId });
  } else {
    clauses.push({ isPublished: true });
    clauses.push({ publishDate: { $lte: now } });
    clauses.push({ $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }] });
    if (scope.kind === "teacher") {
      clauses.push({ $or: [{ classId: null }, { classId: { $in: scope.taughtClassIds } }] });
      if (filters.classId) clauses.push({ classId: filters.classId });
    } else if (scope.kind === "student") {
      clauses.push({ $or: [{ classId: null }, { classId: { $in: scope.classIds } }] });
      if (filters.classId) clauses.push({ classId: filters.classId });
    } else {
      clauses.push({ classId: null });
    }
  }

  return { $and: clauses };
}
