import type { Request, Response, NextFunction } from "express";
import {
  createAnnouncementService,
  getAllAnnouncementsService,
  getAnnouncementByIdService,
  updateAnnouncementService,
  deleteAnnouncementService,
} from "../services/announcement.service.js";
import ApiError from "../utils/ApiError.js";

export const createAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const announcement = await createAnnouncementService({
      ...req.body,
      publishedBy: req.user._id,
    });
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
    const { audience, classId, isPublished, page, limit } = req.query;

    const filters: {
      audience?: string;
      classId?: string;
      isPublished?: boolean;
      page?: number;
      limit?: number;
    } = {};

    if (audience) filters.audience = audience as string;
    if (classId) filters.classId = classId as string;
    if (isPublished !== undefined) filters.isPublished = isPublished === "true";
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await getAllAnnouncementsService(filters);
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
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Announcement ID is required" });
      return;
    }
    const announcement = await getAnnouncementByIdService(id);
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
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Announcement ID is required" });
      return;
    }
    const announcement = await updateAnnouncementService(id, req.body);
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
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Announcement ID is required" });
      return;
    }
    await deleteAnnouncementService(id);
    res.status(200).json({ success: true, data: null, message: "Announcement deleted successfully" });
  } catch (error) {
    next(error);
  }
};