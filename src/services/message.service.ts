import mongoose, { type Types } from "mongoose";
import Class from "../models/Class.model.js";
import Message from "../models/Message.model.js";
import Student from "../models/Student.model.js";
import Teacher from "../models/Teacher.model.js";
import User from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import { searchUserDirectory } from "./user.service.js";

export interface CreateMessageInput {
  receiverId: string;
  subject: string;
  content: string;
  senderId: Types.ObjectId;
}

const objectIdPattern = /^[a-f\d]{24}$/i;

function requireObjectId(id: string, message = "A valid id is required"): void {
  if (!objectIdPattern.test(id)) {
    throw new ApiError(400, message);
  }
}

function refId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "object" && "_id" in value) {
    return refId((value as { _id: unknown })._id);
  }
  return "";
}

function personName(record: { firstname?: string; lastname?: string } | null | undefined) {
  return {
    firstname: record?.firstname ?? "",
    lastname: record?.lastname ?? "",
  };
}

async function rosterStudentUsers(teacherUserId: string) {
  const teacher = await Teacher.findOne({ userId: teacherUserId }).select("_id");
  if (!teacher) return [];
  const classes = await Class.find({ teacherId: teacher._id }).select("students");
  const studentIds = [...new Set(classes.flatMap((item) => item.students.map((id) => id.toString())))];
  if (studentIds.length === 0) return [];
  return Student.find({ _id: { $in: studentIds } }).select("userId firstName lastName studentId");
}

async function classTeacherUsers(studentUserId: string) {
  const student = await Student.findOne({ userId: studentUserId }).select("_id");
  if (!student) return [];
  const classes = await Class.find({ students: student._id }).select("teacherId");
  const teacherIds = [...new Set(classes.flatMap((item) => (item.teacherId ? [item.teacherId.toString()] : [])))];
  if (teacherIds.length === 0) return [];
  return Teacher.find({ _id: { $in: teacherIds } }).select("userId firstName lastName teacherId");
}

async function hasThread(userId: string, otherUserId: string) {
  const existing = await Message.exists({
    $or: [
      { senderId: userId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: userId },
    ],
  });
  return Boolean(existing);
}

export async function assertCanMessage(senderId: string, receiverId: string) {
  requireObjectId(receiverId, "A valid user id is required");
  if (receiverId === senderId) {
    throw new ApiError(400, "Cannot send a message to yourself.");
  }
  const [sender, receiver] = await Promise.all([
    User.findById(senderId).select("role"),
    User.findById(receiverId).select("_id"),
  ]);
  if (!sender) throw new ApiError(401, "Unauthorized");
  if (!receiver) throw new ApiError(404, "Receiver not found.");
  if (sender.role === "admin") return;
  if (await hasThread(senderId, receiverId)) return;

  const [students, teachers] = await Promise.all([
    rosterStudentUsers(senderId),
    classTeacherUsers(senderId),
  ]);
  const allowed = new Set<string>([
    ...students.map((student) => student.userId.toString()),
    ...teachers.map((teacher) => teacher.userId.toString()),
  ]);
  if (!allowed.has(receiverId)) {
    throw new ApiError(403, "You cannot start a conversation with this account.");
  }
}

export const createMessageService = async (data: CreateMessageInput) => {
  const senderId = data.senderId.toString();
  await assertCanMessage(senderId, data.receiverId);
  const subject = data.subject.trim();
  const content = data.content.trim();
  if (!subject) throw new ApiError(400, "Subject is required");
  if (!content) throw new ApiError(400, "Content is required");

  return Message.create({
    senderId: data.senderId,
    receiverId: data.receiverId,
    subject,
    content,
  });
};

function pageLimit(page?: number, limit?: number) {
  const safePage = Number.isInteger(page) && (page ?? 0) > 0 ? (page as number) : 1;
  const requested = Number.isInteger(limit) ? (limit as number) : 20;
  const safeLimit = requested > 0 && requested <= 50 ? requested : 20;
  return { page: safePage, limit: safeLimit };
}

export const getInboxService = async (
  userId: string,
  filters: { isRead?: boolean; page?: number; limit?: number },
) => {
  const { isRead } = filters;
  const { page, limit } = pageLimit(filters.page, filters.limit);
  const query: Record<string, unknown> = { receiverId: userId };
  if (isRead !== undefined) query.isRead = isRead;
  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    Message.find(query).populate("senderId", "firstname lastname").skip(skip).limit(limit).sort({ createdAt: -1 }),
    Message.countDocuments(query),
  ]);
  return { messages, total, page, totalPages: Math.ceil(total / limit) };
};

export const getSentService = async (
  userId: string,
  filters: { page?: number; limit?: number },
) => {
  const { page, limit } = pageLimit(filters.page, filters.limit);
  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    Message.find({ senderId: userId })
      .populate("receiverId", "firstname lastname")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Message.countDocuments({ senderId: userId }),
  ]);
  return { messages, total, page, totalPages: Math.ceil(total / limit) };
};

async function loadMessageForParticipant(id: string, userId: string) {
  requireObjectId(id);
  const message = await Message.findById(id);
  if (!message) throw new ApiError(404, "Message not found");
  const sender = message.senderId.toString();
  const receiver = message.receiverId.toString();
  if (sender !== userId && receiver !== userId) {
    throw new ApiError(404, "Message not found");
  }
  return message;
}

export const getMessageByIdService = async (id: string, userId: string) => {
  requireObjectId(id);
  const message = await Message.findById(id)
    .populate("senderId", "firstname lastname")
    .populate("receiverId", "firstname lastname");
  if (!message) throw new ApiError(404, "Message not found");
  const sender = refId(message.senderId);
  const receiver = refId(message.receiverId);
  if (sender !== userId && receiver !== userId) {
    throw new ApiError(404, "Message not found");
  }
  return message;
};

export const markAsReadService = async (id: string, userId: string) => {
  const message = await loadMessageForParticipant(id, userId);
  if (message.receiverId.toString() !== userId) {
    throw new ApiError(403, "You are not authorized to mark this message as read");
  }
  message.isRead = true;
  message.readAt = new Date();
  await message.save();
  return message;
};

export const deleteMessageService = async (id: string, userId: string) => {
  const message = await loadMessageForParticipant(id, userId);
  await Message.findByIdAndDelete(id);
  return message;
};

export const getUnreadCountService = async (userId: string) => {
  const count = await Message.countDocuments({ receiverId: userId, isRead: false });
  return { unreadCount: count };
};

export const listEligibleRecipientsService = async (userId: string, search = "") => {
  const sender = await User.findById(userId).select("role");
  if (!sender) throw new ApiError(401, "Unauthorized");
  const term = search.trim().toLowerCase();

  if (sender.role === "admin") {
    if (term.length < 2) return { recipients: [], searchRequired: true };
    const directory = await searchUserDirectory({ search: term, limit: 20 });
    return {
      searchRequired: true,
      recipients: directory.users
        .filter((user) => user.id !== userId)
        .map((user) => ({
          id: user.id,
          firstname: user.firstname,
          lastname: user.lastname,
          detail: user.username,
        })),
    };
  }

  const [students, teachers] = await Promise.all([rosterStudentUsers(userId), classTeacherUsers(userId)]);
  const recipients = [
    ...students.map((student) => ({
      id: student.userId.toString(),
      firstname: student.firstName,
      lastname: student.lastName,
      detail: student.studentId,
    })),
    ...teachers.map((teacher) => ({
      id: teacher.userId.toString(),
      firstname: teacher.firstName,
      lastname: teacher.lastName,
      detail: teacher.teacherId,
    })),
  ].filter((recipient) => recipient.id !== userId);
  const unique = [...new Map(recipients.map((recipient) => [recipient.id, recipient])).values()];
  const filtered = term
    ? unique.filter((recipient) =>
        `${recipient.firstname} ${recipient.lastname} ${recipient.detail}`.toLowerCase().includes(term),
      )
    : unique;
  return { recipients: filtered.slice(0, 20), searchRequired: false };
};

function pairQuery(userId: string, participantId: string) {
  return {
    $or: [
      { senderId: userId, receiverId: participantId },
      { senderId: participantId, receiverId: userId },
    ],
  };
}

async function assertThreadVisible(userId: string, participantId: string) {
  requireObjectId(participantId, "A valid user id is required");
  if (participantId === userId) {
    throw new ApiError(400, "Cannot open a conversation with yourself.");
  }
  const participant = await User.findById(participantId).select("_id");
  if (!participant) throw new ApiError(404, "Receiver not found.");
  if (await hasThread(userId, participantId)) return;
  try {
    await assertCanMessage(userId, participantId);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 403) throw error;
    throw error;
  }
}

export const listConversationsService = async (
  userId: string,
  filters: { page?: number; limit?: number },
) => {
  const { page, limit } = pageLimit(filters.page, filters.limit);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const grouped = await Message.aggregate<{
    _id: Types.ObjectId;
    lastSubject: string;
    lastContent: string;
    lastCreatedAt: Date;
    lastSenderId: Types.ObjectId;
    lastIsRead: boolean;
    lastId: Types.ObjectId;
    unreadCount: number;
  }>([
    { $match: { $or: [{ senderId: userObjectId }, { receiverId: userObjectId }] } },
    { $sort: { createdAt: -1 } },
    {
      $addFields: {
        participantId: { $cond: [{ $eq: ["$senderId", userObjectId] }, "$receiverId", "$senderId"] },
      },
    },
    {
      $group: {
        _id: "$participantId",
        lastSubject: { $first: "$subject" },
        lastContent: { $first: "$content" },
        lastCreatedAt: { $first: "$createdAt" },
        lastSenderId: { $first: "$senderId" },
        lastIsRead: { $first: "$isRead" },
        lastId: { $first: "$_id" },
        unreadCount: {
          $sum: {
            $cond: [{ $and: [{ $eq: ["$receiverId", userObjectId] }, { $eq: ["$isRead", false] }] }, 1, 0],
          },
        },
      },
    },
    { $sort: { lastCreatedAt: -1 } },
  ]);

  const total = grouped.length;
  const slice = grouped.slice((page - 1) * limit, page * limit);
  const people = await User.find({ _id: { $in: slice.map((item) => item._id) } }).select("firstname lastname");
  const names = new Map(people.map((person) => [person._id.toString(), person]));

  return {
    conversations: slice.map((item) => {
      const person = names.get(item._id.toString());
      return {
        participant: { id: item._id.toString(), ...personName(person) },
        unreadCount: item.unreadCount,
        lastMessage: {
          id: item.lastId.toString(),
          subject: item.lastSubject,
          content: item.lastContent,
          createdAt: item.lastCreatedAt,
          isRead: item.lastIsRead,
          senderId: item.lastSenderId.toString(),
        },
      };
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const getConversationService = async (
  userId: string,
  participantId: string,
  filters: { page?: number; limit?: number },
) => {
  await assertThreadVisible(userId, participantId);
  const { page, limit } = pageLimit(filters.page, filters.limit);
  const query = pairQuery(userId, participantId);
  const skip = (page - 1) * limit;
  const [latestFirst, total, participant] = await Promise.all([
    Message.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Message.countDocuments(query),
    User.findById(participantId).select("firstname lastname"),
  ]);
  const ordered = [...latestFirst].reverse();
  const ids = [...new Set(ordered.flatMap((message) => [message.senderId.toString(), message.receiverId.toString()]))];
  const people = await User.find({ _id: { $in: ids } }).select("firstname lastname");
  const names = new Map(people.map((person) => [person._id.toString(), person]));
  const asPerson = (id: string) => ({ id, ...personName(names.get(id)) });

  return {
    participant: { id: participantId, ...personName(participant) },
    messages: ordered.map((message) => ({
      id: message._id.toString(),
      subject: message.subject,
      content: message.content,
      createdAt: message.createdAt,
      isRead: message.isRead,
      readAt: message.readAt ?? null,
      sender: asPerson(message.senderId.toString()),
      receiver: asPerson(message.receiverId.toString()),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

export const markConversationReadService = async (userId: string, participantId: string) => {
  await assertThreadVisible(userId, participantId);
  const result = await Message.updateMany(
    { senderId: participantId, receiverId: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
  return { updated: result.modifiedCount };
};
