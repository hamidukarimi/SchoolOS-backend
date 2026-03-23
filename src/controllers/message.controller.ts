import type { Request, Response, NextFunction } from "express";
import {
  createMessageService,
  getInboxService,
  getSentService,
  getMessageByIdService,
  markAsReadService,
  deleteMessageService,
  getUnreadCountService,
} from "../services/message.service.js";
import ApiError from "../utils/ApiError.js";

export const createMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const message = await createMessageService({
      ...req.body,
      senderId: req.user._id,
    });
    res.status(201).json({ success: true, data: message, message: "Message sent successfully" });
  } catch (error) {
    next(error);
  }
};

export const getInbox = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const { isRead, page, limit } = req.query;

    const filters: {
      isRead?: boolean;
      page?: number;
      limit?: number;
    } = {};

    if (isRead !== undefined) filters.isRead = isRead === "true";
    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await getInboxService(req.user._id.toString(), filters);
    res.status(200).json({ success: true, data: result, message: "Inbox fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getSent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");

    const { page, limit } = req.query;

    const filters: {
      page?: number;
      limit?: number;
    } = {};

    if (page) filters.page = Number(page);
    if (limit) filters.limit = Number(limit);

    const result = await getSentService(req.user._id.toString(), filters);
    res.status(200).json({ success: true, data: result, message: "Sent messages fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getMessageById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Message ID is required" });
      return;
    }
    const message = await getMessageByIdService(id, req.user._id.toString());
    res.status(200).json({ success: true, data: message, message: "Message fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Message ID is required" });
      return;
    }
    const message = await markAsReadService(id, req.user._id.toString());
    res.status(200).json({ success: true, data: message, message: "Message marked as read" });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      res.status(400).json({ success: false, message: "Message ID is required" });
      return;
    }
    await deleteMessageService(id, req.user._id.toString());
    res.status(200).json({ success: true, data: null, message: "Message deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const result = await getUnreadCountService(req.user._id.toString());
    res.status(200).json({ success: true, data: result, message: "Unread count fetched successfully" });
  } catch (error) {
    next(error);
  }
};