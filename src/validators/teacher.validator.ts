import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid id is required");

export const createTeacherSchema = z.object({
  userId: objectId,
  teacherId: z.string().min(1, "Teacher ID is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female"] as const, {
    message: "Gender must be male or female",
  }),
  phone: z.string().optional(),
  address: z.string().optional(),
  subject: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.number().min(0).optional(),
  salary: z.number().min(0).optional(),
  joinDate: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"] as const).optional(),
});

export const updateTeacherSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"] as const).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  subject: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.number().min(0).optional(),
  salary: z.number().min(0).optional(),
  joinDate: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"] as const).optional(),
});