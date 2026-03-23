import Announcement from "../models/Announcement.model.js";
import type { IAnnouncement } from "../models/Announcement.model.js";
import ApiError from "../utils/ApiError.js";

export const createAnnouncementService = async (
  data: Partial<IAnnouncement>
) => {
  const announcement = await Announcement.create(data);
  return announcement;
};

export const getAllAnnouncementsService = async (filters: {
  audience?: string;
  classId?: string;
  isPublished?: boolean;
  page?: number;
  limit?: number;
}) => {
  const { audience, classId, isPublished, page = 1, limit = 20 } = filters;

  const query: any = {};

  if (audience) query.audience = { $in: [audience, "all"] };
  if (classId) query.classId = classId;
  if (isPublished !== undefined) query.isPublished = isPublished;

  const skip = (page - 1) * limit;

  const [announcements, total] = await Promise.all([
    Announcement.find(query)
      .populate("publishedBy", "firstname lastname")
      .populate("classId", "name section grade")
      .skip(skip)
      .limit(limit)
      .sort({ publishDate: -1 }),
    Announcement.countDocuments(query),
  ]);

  return {
    announcements,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getAnnouncementByIdService = async (id: string) => {
  const announcement = await Announcement.findById(id)
    .populate("publishedBy", "firstname lastname")
    .populate("classId", "name section grade");

  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  return announcement;
};

export const updateAnnouncementService = async (
  id: string,
  data: Partial<IAnnouncement>
) => {
  const announcement = await Announcement.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  return announcement;
};

export const deleteAnnouncementService = async (id: string) => {
  const announcement = await Announcement.findByIdAndDelete(id);

  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  return announcement;
};