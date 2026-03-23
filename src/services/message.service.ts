import Message from "../models/Message.model.js";
import type { IMessage } from "../models/Message.model.js";
import ApiError from "../utils/ApiError.js";

export const createMessageService = async (data: Partial<IMessage>) => {
  const message = await Message.create(data);
  return message;
};

export const getInboxService = async (
  userId: string,
  filters: {
    isRead?: boolean;
    page?: number;
    limit?: number;
  }
) => {
  const { isRead, page = 1, limit = 20 } = filters;

  const query: any = { receiverId: userId };
  if (isRead !== undefined) query.isRead = isRead;

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    Message.find(query)
      .populate("senderId", "firstname lastname")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Message.countDocuments(query),
  ]);

  return {
    messages,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getSentService = async (
  userId: string,
  filters: {
    page?: number;
    limit?: number;
  }
) => {
  const { page = 1, limit = 20 } = filters;

  const query: any = { senderId: userId };

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    Message.find(query)
      .populate("receiverId", "firstname lastname")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Message.countDocuments(query),
  ]);

  return {
    messages,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getMessageByIdService = async (id: string, userId: string) => {
  const message = await Message.findById(id)
    .populate("senderId", "firstname lastname")
    .populate("receiverId", "firstname lastname");

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  if (
    message.senderId._id.toString() !== userId &&
    message.receiverId._id.toString() !== userId
  ) {
    throw new ApiError(403, "You are not authorized to view this message");
  }

  return message;
};

export const markAsReadService = async (id: string, userId: string) => {
  const message = await Message.findById(id);

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  if (message.receiverId.toString() !== userId) {
    throw new ApiError(403, "You are not authorized to mark this message as read");
  }

  message.isRead = true;
  message.readAt = new Date();
  await message.save();

  return message;
};

export const deleteMessageService = async (id: string, userId: string) => {
  const message = await Message.findById(id);

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  if (
    message.senderId.toString() !== userId &&
    message.receiverId.toString() !== userId
  ) {
    throw new ApiError(403, "You are not authorized to delete this message");
  }

  await Message.findByIdAndDelete(id);
  return message;
};

export const getUnreadCountService = async (userId: string) => {
  const count = await Message.countDocuments({
    receiverId: userId,
    isRead: false,
  });

  return { unreadCount: count };
};