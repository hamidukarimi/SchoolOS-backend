import Timetable from "../models/Timetable.model.js";
import type { ITimetable } from "../models/Timetable.model.js";
import ApiError from "../utils/ApiError.js";
import type { IUserDocument } from "../models/User.model.js";
import type { SchoolReadScope } from "../types/schoolReadScope.js";
import {
  assertSchoolDataAccess,
  assertSchoolMutationAllowed,
  idInObjectIdList,
} from "../utils/schoolReadAccess.js";
import { notifyTimetableSaved } from "./notificationEvents.js";

export const createTimetableService = async (
  data: Partial<ITimetable>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const conflict = await Timetable.findOne({
    teacherId: data.teacherId,
    dayOfWeek: data.dayOfWeek,
    academicYear: data.academicYear,
    status: "active",
    $or: [
      {
        startTime: { $lt: data.endTime },
        endTime: { $gt: data.startTime },
      },
    ],
  } as Record<string, unknown>);

  if (conflict) {
    throw new ApiError(400, "Teacher already has a class at this time");
  }

  const timetable = await Timetable.create(data);
  await notifyTimetableSaved(timetable);
  return timetable;
};

export const getAllTimetablesService = async (
  filters: {
    classId?: string;
    teacherId?: string;
    dayOfWeek?: string;
    academicYear?: string;
    page?: number;
    limit?: number;
  },
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);

  const { classId, teacherId, dayOfWeek, academicYear, page = 1, limit = 20 } =
    filters;

  const query: Record<string, unknown> = {};

  if (classId) query.classId = classId;
  if (teacherId) query.teacherId = teacherId;
  if (dayOfWeek) query.dayOfWeek = dayOfWeek;
  if (academicYear) query.academicYear = academicYear;

  if (scope.kind === "teacher") {
    const orClause: Record<string, unknown>[] = [
      { teacherId: scope.teacherDocId },
    ];
    if (scope.taughtClassIds.length > 0) {
      orClause.push({ classId: { $in: scope.taughtClassIds } });
    }
    query.$or = orClause;
  } else if (scope.kind === "student") {
    if (scope.classIds.length === 0) {
      query._id = { $in: [] };
    } else {
      query.classId = { $in: scope.classIds };
    }
  }

  const skip = (page - 1) * limit;

  const [timetables, total] = await Promise.all([
    Timetable.find(query)
      .populate("classId", "name section grade")
      .populate("teacherId", "firstName lastName teacherId subject")
      .skip(skip)
      .limit(limit)
      .sort({ dayOfWeek: 1, startTime: 1 }),
    Timetable.countDocuments(query),
  ]);

  return {
    timetables,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getTimetableByIdService = async (
  id: string,
  scope: SchoolReadScope,
) => {
  assertSchoolDataAccess(scope);

  const raw = await Timetable.findById(id).lean();
  if (!raw) {
    throw new ApiError(404, "Timetable entry not found");
  }

  const classIdStr = raw.classId.toString();
  const teacherIdStr = raw.teacherId.toString();

  if (scope.kind === "teacher") {
    const ownsSlot = teacherIdStr === scope.teacherDocId.toString();
    const teachesClass = idInObjectIdList(classIdStr, scope.taughtClassIds);
    if (!ownsSlot && !teachesClass) {
      throw new ApiError(403, "You do not have access to this timetable.");
    }
  }

  if (scope.kind === "student") {
    if (!idInObjectIdList(classIdStr, scope.classIds)) {
      throw new ApiError(403, "You do not have access to this timetable.");
    }
  }

  const timetable = await Timetable.findById(id)
    .populate("classId", "name section grade")
    .populate("teacherId", "firstName lastName teacherId subject");

  return timetable!;
};

export const updateTimetableService = async (
  id: string,
  data: Partial<ITimetable>,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const previous = await Timetable.findById(id);
  const timetable = await Timetable.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!timetable) {
    throw new ApiError(404, "Timetable entry not found");
  }

  if (previous) await notifyTimetableSaved(timetable, previous);
  else await notifyTimetableSaved(timetable);
  return timetable;
};

export const deleteTimetableService = async (
  id: string,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const timetable = await Timetable.findByIdAndDelete(id);

  if (!timetable) {
    throw new ApiError(404, "Timetable entry not found");
  }

  return timetable;
};
