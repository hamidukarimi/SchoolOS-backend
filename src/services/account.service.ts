import mongoose from "mongoose";
import Session from "../models/Session.model.js";
import Staff from "../models/Staff.model.js";
import Student from "../models/Student.model.js";
import Teacher from "../models/Teacher.model.js";
import User from "../models/User.model.js";
import type { ILocation, IUserDocument } from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import type { AccountListQuery, CreateAccountInput, UpdateAccountInput } from "../validators/account.validator.js";

const OBJECT_ID = /^[a-f\d]{24}$/i;

interface AccountLinks {
  hasStudentProfile: boolean;
  hasTeacherProfile: boolean;
  hasStaffRecord: boolean;
  studentProfileId?: string;
  teacherProfileId?: string;
  staffRecordId?: string;
}

function requireObjectId(id: string): void {
  if (!OBJECT_ID.test(id)) {
    throw new ApiError(400, "A valid id is required");
  }
}

function escapeSearch(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function duplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

async function linksFor(userIds: mongoose.Types.ObjectId[]): Promise<Map<string, AccountLinks>> {
  const [students, teachers, staff] = await Promise.all([
    Student.find({ userId: { $in: userIds } }).select("userId").lean(),
    Teacher.find({ userId: { $in: userIds } }).select("userId").lean(),
    Staff.find({ userId: { $in: userIds } }).select("userId").lean(),
  ]);
  const links = new Map<string, AccountLinks>();
  const blank = (): AccountLinks => ({
    hasStudentProfile: false,
    hasTeacherProfile: false,
    hasStaffRecord: false,
  });
  for (const student of students) {
    const key = student.userId.toString();
    const current = links.get(key) ?? blank();
    current.hasStudentProfile = true;
    current.studentProfileId = student._id.toString();
    links.set(key, current);
  }
  for (const teacher of teachers) {
    const key = teacher.userId.toString();
    const current = links.get(key) ?? blank();
    current.hasTeacherProfile = true;
    current.teacherProfileId = teacher._id.toString();
    links.set(key, current);
  }
  for (const member of staff) {
    const key = member.userId.toString();
    const current = links.get(key) ?? blank();
    current.hasStaffRecord = true;
    current.staffRecordId = member._id.toString();
    links.set(key, current);
  }
  return links;
}

function presentText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function locationInput(location: { city?: string | undefined; country?: string | undefined } | undefined): ILocation | undefined {
  if (!location) return undefined;
  const city = presentText(location.city);
  const country = presentText(location.country);
  if (!city && !country) return undefined;
  const next: ILocation = {};
  if (city) next.city = city;
  if (country) next.country = country;
  return next;
}

function publicAccount(user: IUserDocument, links: AccountLinks, includeDetail: boolean) {
  const account: Record<string, unknown> = {
    id: user._id.toString(),
    firstname: user.firstname,
    lastname: user.lastname,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    hasStudentProfile: links.hasStudentProfile,
    hasTeacherProfile: links.hasTeacherProfile,
    hasStaffRecord: links.hasStaffRecord,
  };

  if (includeDetail) {
    account.isVerified = user.isVerified;
    account.createdAt = user.createdAt;
    account.updatedAt = user.updatedAt;
    if (user.gender) account.gender = user.gender;
    if (user.birthday) account.birthday = user.birthday;
    if (user.lastLogin) account.lastLogin = user.lastLogin;
    const city = presentText(user.location?.city);
    const country = presentText(user.location?.country);
    if (city || country) {
      account.location = {
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
      };
    }
    if (links.studentProfileId) account.studentProfileId = links.studentProfileId;
    if (links.teacherProfileId) account.teacherProfileId = links.teacherProfileId;
    if (links.staffRecordId) account.staffRecordId = links.staffRecordId;
  }

  return account;
}

async function accountFor(user: IUserDocument, includeDetail: boolean) {
  const links = await linksFor([user._id]);
  return publicAccount(user, links.get(user._id.toString()) ?? {
    hasStudentProfile: false,
    hasTeacherProfile: false,
    hasStaffRecord: false,
  }, includeDetail);
}

export async function listAccountsService(filters: AccountListQuery) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const search = filters.search?.trim() ?? "";
  const query: Record<string, unknown> = {};
  if (filters.role) query.role = filters.role;
  if (filters.status === "active") query.isActive = true;
  if (filters.status === "inactive") query.isActive = false;
  if (search) {
    const pattern = new RegExp(escapeSearch(search), "i");
    query.$or = [{ firstname: pattern }, { lastname: pattern }, { username: pattern }, { email: pattern }];
  }

  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    User.find(query).sort({ lastname: 1, firstname: 1, _id: 1 }).skip(skip).limit(limit),
    User.countDocuments(query),
  ]);
  const links = await linksFor(records.map((record) => record._id));

  return {
    accounts: records.map((record) =>
      publicAccount(record, links.get(record._id.toString()) ?? {
        hasStudentProfile: false,
        hasTeacherProfile: false,
        hasStaffRecord: false,
      }, false),
    ),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function getAccountService(id: string) {
  requireObjectId(id);
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "Account not found");
  return accountFor(user, true);
}

async function assertUsernameAvailable(username: string, exceptId?: string): Promise<void> {
  const taken = await User.findOne({ username });
  if (taken && taken._id.toString() !== exceptId) {
    throw new ApiError(409, "Username already taken");
  }
}

async function assertEmailAvailable(email: string, exceptId?: string): Promise<void> {
  const taken = await User.findOne({ email });
  if (taken && taken._id.toString() !== exceptId) {
    throw new ApiError(400, "Email already registered");
  }
}

export async function createAccountService(input: CreateAccountInput) {
  const email = input.email.toLowerCase();
  await assertEmailAvailable(email);
  await assertUsernameAvailable(input.username);

  try {
    const location = locationInput(input.location);
    const user = await User.create({
      firstname: input.firstname,
      lastname: input.lastname,
      username: input.username,
      email,
      password: input.password,
      role: input.role,
      ...(input.birthday ? { birthday: input.birthday } : {}),
      ...(input.gender ? { gender: input.gender } : {}),
      ...(location ? { location } : {}),
    });
    return accountFor(user, true);
  } catch (error) {
    if (duplicateKey(error)) throw new ApiError(400, "Email already registered");
    throw error;
  }
}

async function assertAdminAccessRemains(user: IUserDocument, input: UpdateAccountInput, actorId: string): Promise<void> {
  const nextRole = input.role ?? user.role;
  const nextActive = input.isActive ?? user.isActive;
  const removingAccess = user.role === "admin" && user.isActive && !(nextRole === "admin" && nextActive);
  if (!removingAccess) return;

  const activeAdmins = await User.countDocuments({ role: "admin", isActive: true });
  if (activeAdmins <= 1) {
    throw new ApiError(400, "The last active administrator account cannot be changed.");
  }
  if (user._id.toString() === actorId) {
    throw new ApiError(400, "You cannot remove your own administrator access.");
  }
}

export async function updateAccountService(id: string, input: UpdateAccountInput, actorId: string) {
  requireObjectId(id);
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "Account not found");

  if (input.password && user._id.toString() === actorId) {
    throw new ApiError(400, "Use the password page to change your own password.");
  }

  await assertAdminAccessRemains(user, input, actorId);

  if (input.username && input.username !== user.username) {
    await assertUsernameAvailable(input.username, user._id.toString());
  }
  const email = input.email?.toLowerCase();
  if (email && email !== user.email) {
    await assertEmailAvailable(email, user._id.toString());
  }

  if (input.firstname) user.firstname = input.firstname;
  if (input.lastname) user.lastname = input.lastname;
  if (input.username) user.username = input.username;
  if (email) user.email = email;
  if (input.gender) user.gender = input.gender;
  if (input.birthday) user.birthday = input.birthday;
  if (input.location) {
    const location = locationInput(input.location);
    user.location = location ?? {};
  }
  if (input.role) user.role = input.role;
  if (typeof input.isActive === "boolean") user.isActive = input.isActive;

  const revoke = Boolean(input.password) || input.isActive === false;
  if (input.password) user.password = input.password;
  if (revoke) user.tokenVersion += 1;

  try {
    await user.save();
  } catch (error) {
    if (duplicateKey(error)) throw new ApiError(400, "Email already registered");
    throw error;
  }

  if (revoke) await Session.deleteMany({ user: user._id });
  return accountFor(user, true);
}
