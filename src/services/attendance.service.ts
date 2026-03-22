import Attendance from "../models/Attendance.model.js";
import type { IAttendance } from "../models/Attendance.model.js";
import ApiError from "../utils/ApiError.js";

export const createAttendanceService = async (data: Partial<IAttendance>) => {
  const existing = await Attendance.findOne({
    studentId: data.studentId,
    classId: data.classId,
    date: data.date,
  } as any);

  if (existing) {
    throw new ApiError(400, "Attendance already recorded for this student on this date");
  }

  const attendance = await Attendance.create(data);
  return attendance;
};

export const bulkCreateAttendanceService = async (data: {
  classId: string;
  teacherId: string;
  date: string;
  records: { studentId: string; status: string; note?: string }[];
}) => {
  const { classId, teacherId, date, records } = data;

  const attendanceDocs = records.map((record) => ({
    classId,
    teacherId,
    date: new Date(date),
    studentId: record.studentId,
    status: record.status,
    ...(record.note && { note: record.note }),
  }));

  const result = await Attendance.insertMany(attendanceDocs, {
    ordered: false,
  });

  return result;
};

export const getAllAttendanceService = async (filters: {
  studentId?: string;
  classId?: string;
  teacherId?: string;
  status?: string;
  date?: string;
  page?: number;
  limit?: number;
}) => {
  const { studentId, classId, teacherId, status, date, page = 1, limit = 20 } = filters;

  const query: any = {};

  if (studentId) query.studentId = studentId;
  if (classId) query.classId = classId;
  if (teacherId) query.teacherId = teacherId;
  if (status) query.status = status;
  if (date) query.date = new Date(date);

  const skip = (page - 1) * limit;

  const [attendance, total] = await Promise.all([
    Attendance.find(query)
      .populate("studentId", "firstName lastName studentId")
      .populate("classId", "name section grade")
      .populate("teacherId", "firstName lastName teacherId")
      .skip(skip)
      .limit(limit)
      .sort({ date: -1 }),
    Attendance.countDocuments(query),
  ]);

  return {
    attendance,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getAttendanceByIdService = async (id: string) => {
  const attendance = await Attendance.findById(id)
    .populate("studentId", "firstName lastName studentId")
    .populate("classId", "name section grade")
    .populate("teacherId", "firstName lastName teacherId");

  if (!attendance) {
    throw new ApiError(404, "Attendance record not found");
  }

  return attendance;
};

export const updateAttendanceService = async (
  id: string,
  data: Partial<IAttendance>
) => {
  const attendance = await Attendance.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!attendance) {
    throw new ApiError(404, "Attendance record not found");
  }

  return attendance;
};

export const deleteAttendanceService = async (id: string) => {
  const attendance = await Attendance.findByIdAndDelete(id);

  if (!attendance) {
    throw new ApiError(404, "Attendance record not found");
  }

  return attendance;
};

export const getStudentAttendanceSummaryService = async (
  studentId: string,
  classId?: string
) => {
  const query: any = { studentId };
  if (classId) query.classId = classId;

  const [present, absent, late, excused] = await Promise.all([
    Attendance.countDocuments({ ...query, status: "present" }),
    Attendance.countDocuments({ ...query, status: "absent" }),
    Attendance.countDocuments({ ...query, status: "late" }),
    Attendance.countDocuments({ ...query, status: "excused" }),
  ]);

  const total = present + absent + late + excused;
  const attendanceRate = total > 0 ? ((present + late) / total) * 100 : 0;

  return {
    present,
    absent,
    late,
    excused,
    total,
    attendanceRate: Math.round(attendanceRate * 100) / 100,
  };
};