import type { Request, Response, NextFunction } from "express";
import {
  createMessageService,
  getInboxService,
  getSentService,
  getMessageByIdService,
  markAsReadService,
  deleteMessageService,
  getUnreadCountService,
  listConversationsService,
  getConversationService,
  markConversationReadService,
  listEligibleRecipientsService,
} from "../services/message.service.js";
import ApiError from "../utils/ApiError.js";

export const createMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { receiverId, subject, content } = req.body as {
      receiverId: string;
      subject: string;
      content: string;
    };
    const message = await createMessageService({
      receiverId,
      subject,
      content,
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

export const listConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await listConversationsService(req.user._id.toString(), {
      ...(page !== undefined ? { page } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
    res.status(200).json({ success: true, data: result, message: "Conversations fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const getConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { participantId } = req.params;
    if (!participantId || Array.isArray(participantId)) {
      res.status(400).json({ success: false, message: "A valid user id is required" });
      return;
    }
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await getConversationService(req.user._id.toString(), participantId, {
      ...(page !== undefined ? { page } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
    res.status(200).json({ success: true, data: result, message: "Conversation fetched successfully" });
  } catch (error) {
    next(error);
  }
};

export const markConversationRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const { participantId } = req.params;
    if (!participantId || Array.isArray(participantId)) {
      res.status(400).json({ success: false, message: "A valid user id is required" });
      return;
    }
    const result = await markConversationReadService(req.user._id.toString(), participantId);
    res.status(200).json({ success: true, data: result, message: "Conversation marked as read" });
  } catch (error) {
    next(error);
  }
};

export const listRecipients = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized");
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const result = await listEligibleRecipientsService(req.user._id.toString(), search);
    res.status(200).json({ success: true, data: result, message: "Recipients fetched successfully" });
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