import type { Request, Response, NextFunction } from "express";
import {
  createAnnouncementService,
  getAllAnnouncementsService,
  getAnnouncementByIdService,
  updateAnnouncementService,
  deleteAnnouncementService,
} from "../services/announcement.service.js";
import ApiError from "../utils/ApiError.js";
import type { AnnouncementAudience } from "../utils/announcementAccess.js";

function requireScope(req: Request) {
  if (!req.schoolReadScope) throw new ApiError(500, "School read scope not initialized");
  return req.schoolReadScope;
}

export const createAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const announcement = await createAnnouncementService(req.body, req.user);
    res.status(201).json({ success: true, data: announcement, message: "Announcement created successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAllAnnouncements = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const scope = requireScope(req);
    const query = req.query as {
      audience?: AnnouncementAudience;
      classId?: string;
      isPublished?: "true" | "false";
      page?: number;
      limit?: number;
    };
    const filters: {
      audience?: AnnouncementAudience;
      classId?: string;
      isPublished?: boolean;
      page?: number;
      limit?: number;
    } = {};
    if (query.audience) filters.audience = query.audience;
    if (query.classId) filters.classId = query.classId;
    if (query.isPublished) filters.isPublished = query.isPublished === "true";
    if (query.page) filters.page = query.page;
    if (query.limit) filters.limit = query.limit;

    const result = await getAllAnnouncementsService(filters, scope);
    res.status(200).json({ success: true, data: result, message: "Announcements fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAnnouncementById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const scope = requireScope(req);
    const { id } = req.params as { id: string };
    const announcement = await getAnnouncementByIdService(id, scope);
    res.status(200).json({ success: true, data: announcement, message: "Announcement fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params as { id: string };
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const announcement = await updateAnnouncementService(id, req.body, req.user);
    res.status(200).json({ success: true, data: announcement, message: "Announcement updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const deleteAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params as { id: string };
    if (!req.user) throw new ApiError(401, "Unauthorized");
    await deleteAnnouncementService(id, req.user);
    res.status(200).json({ success: true, data: null, message: "Announcement deleted successfully" });
  } catch (error) {
    next(error);
  }
};
