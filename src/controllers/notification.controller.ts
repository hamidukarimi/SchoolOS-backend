import type { NextFunction, Request, Response } from "express";
import ApiError from "../utils/ApiError.js";
import {
  countMyUnread,
  deleteMyNotification,
  getMyNotification,
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "../services/notification.service.js";

export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { page, limit, read } = req.query as { page?: number; limit?: number; read?: "read" | "unread" };
    const filters: { page?: number; limit?: number; read?: "read" | "unread" } = {};
    if (page) filters.page = page;
    if (limit) filters.limit = limit;
    if (read) filters.read = read;
    const result = await listMyNotifications(req.user._id.toString(), filters);
    res.status(200).json({ success: true, data: result, message: "Notifications fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const count = await countMyUnread(req.user._id.toString());
    res.status(200).json({ success: true, data: { count }, message: "Unread count fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { id } = req.params as { id: string };
    const notification = await getMyNotification(id, req.user._id.toString());
    res.status(200).json({ success: true, data: notification, message: "Notification fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { id } = req.params as { id: string };
    const notification = await markMyNotificationRead(id, req.user._id.toString());
    res.status(200).json({ success: true, data: notification, message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const updated = await markAllMyNotificationsRead(req.user._id.toString());
    res.status(200).json({
      success: true,
      data: { updated },
      message: "Notifications marked as read",
    });
  } catch (error) {
    next(error);
  }
};

export const removeNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { id } = req.params as { id: string };
    await deleteMyNotification(id, req.user._id.toString());
    res.status(200).json({ success: true, data: null, message: "Notification deleted successfully" });
  } catch (error) {
    next(error);
  }
};
