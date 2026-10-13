import Announcement from "../models/Announcement.model.js";
import type { IAnnouncement } from "../models/Announcement.model.js";
import type { IUserDocument } from "../models/User.model.js";

type AnnouncementWrite = {
  title?: string;
  content?: string;
  audience?: IAnnouncement["audience"];
  classId?: string;
  publishDate?: string | Date;
  expiryDate?: string | Date;
  isPublished?: boolean;
};
import type { SchoolReadScope } from "../types/schoolReadScope.js";
import ApiError from "../utils/ApiError.js";
import { announcementReadQuery, type AnnouncementAudience } from "../utils/announcementAccess.js";
import { assertSchoolMutationAllowed } from "../utils/schoolReadAccess.js";

function announcementFields(data: AnnouncementWrite, actorId: IUserDocument["_id"]) {
  if (!data.title || !data.content) {
    throw new ApiError(400, "Title and content are required");
  }
  return {
    title: data.title,
    content: data.content,
    ...(data.audience ? { audience: data.audience } : {}),
    ...(data.classId ? { classId: data.classId } : {}),
    ...(data.publishDate ? { publishDate: data.publishDate } : {}),
    ...(data.expiryDate ? { expiryDate: data.expiryDate } : {}),
    ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
    publishedBy: actorId,
  };
}

function announcementUpdates(data: AnnouncementWrite): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.content !== undefined) update.content = data.content;
  if (data.audience !== undefined) update.audience = data.audience;
  if (data.classId === "") update.$unset = { classId: 1 };
  else if (data.classId !== undefined) update.classId = data.classId;
  if (data.publishDate !== undefined) update.publishDate = data.publishDate;
  if (data.expiryDate !== undefined) update.expiryDate = data.expiryDate;
  if (data.isPublished !== undefined) update.isPublished = data.isPublished;
  return update;
}

export const createAnnouncementService = async (
  data: AnnouncementWrite,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);
  return Announcement.create(announcementFields(data, actor._id));
};

export const getAllAnnouncementsService = async (
  filters: {
    audience?: AnnouncementAudience;
    classId?: string;
    isPublished?: boolean;
    page?: number;
    limit?: number;
  },
  scope: SchoolReadScope,
) => {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const query = announcementReadQuery(scope, filters);
  const skip = (page - 1) * limit;

  const [announcements, total] = await Promise.all([
    Announcement.find(query)
      .populate("publishedBy", "firstname lastname")
      .populate("classId", "name section grade")
      .skip(skip)
      .limit(limit)
      .sort({ publishDate: -1, _id: -1 }),
    Announcement.countDocuments(query),
  ]);

  return {
    announcements,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getAnnouncementByIdService = async (id: string, scope: SchoolReadScope) => {
  const announcement = await Announcement.findOne({
    $and: [{ _id: id }, announcementReadQuery(scope, {})],
  })
    .populate("publishedBy", "firstname lastname")
    .populate("classId", "name section grade");

  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  return announcement;
};

export const updateAnnouncementService = async (
  id: string,
  data: AnnouncementWrite,
  actor: IUserDocument,
) => {
  assertSchoolMutationAllowed(actor);

  const announcement = await Announcement.findByIdAndUpdate(id, announcementUpdates(data), {
    new: true,
    runValidators: true,
  });

  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  return announcement;
};

export const deleteAnnouncementService = async (id: string, actor: IUserDocument) => {
  assertSchoolMutationAllowed(actor);

  const announcement = await Announcement.findByIdAndDelete(id);

  if (!announcement) {
    throw new ApiError(404, "Announcement not found");
  }

  return announcement;
};
