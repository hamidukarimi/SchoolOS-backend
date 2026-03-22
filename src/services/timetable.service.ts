import Timetable from "../models/Timetable.model.js";
import type { ITimetable } from "../models/Timetable.model.js";
import ApiError from "../utils/ApiError.js";

export const createTimetableService = async (data: Partial<ITimetable>) => {
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
  } as any);

  if (conflict) {
    throw new ApiError(400, "Teacher already has a class at this time");
  }

  const timetable = await Timetable.create(data);
  return timetable;
};

export const getAllTimetablesService = async (filters: {
  classId?: string;
  teacherId?: string;
  dayOfWeek?: string;
  academicYear?: string;
  page?: number;
  limit?: number;
}) => {
  const { classId, teacherId, dayOfWeek, academicYear, page = 1, limit = 20 } = filters;

  const query: any = {};

  if (classId) query.classId = classId;
  if (teacherId) query.teacherId = teacherId;
  if (dayOfWeek) query.dayOfWeek = dayOfWeek;
  if (academicYear) query.academicYear = academicYear;

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

export const getTimetableByIdService = async (id: string) => {
  const timetable = await Timetable.findById(id)
    .populate("classId", "name section grade")
    .populate("teacherId", "firstName lastName teacherId subject");

  if (!timetable) {
    throw new ApiError(404, "Timetable entry not found");
  }

  return timetable;
};

export const updateTimetableService = async (
  id: string,
  data: Partial<ITimetable>
) => {
  const timetable = await Timetable.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!timetable) {
    throw new ApiError(404, "Timetable entry not found");
  }

  return timetable;
};

export const deleteTimetableService = async (id: string) => {
  const timetable = await Timetable.findByIdAndDelete(id);

  if (!timetable) {
    throw new ApiError(404, "Timetable entry not found");
  }

  return timetable;
};