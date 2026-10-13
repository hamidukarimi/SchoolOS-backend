import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid id is required");

export const createStudentSchema = z.object({
  userId: objectId,
  studentId: z.string().min(1, "Student ID is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female"] as const, {
    message: "Gender must be male or female",
  }),
  phone: z.string().optional(),
  address: z.string().optional(),
  classId: objectId.optional(),
  parentName: z.string().min(1, "Parent name is required"),
  parentPhone: z.string().min(1, "Parent phone is required"),
  parentEmail: z.string().email("Invalid parent email").optional(),
  enrollmentDate: z.string().optional(),
  status: z
    .enum(["active", "inactive", "suspended", "graduated"] as const)
    .optional(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"] as const).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  classId: z.string().optional(),
  parentName: z.string().min(1).optional(),
  parentPhone: z.string().min(1).optional(),
  parentEmail: z.string().email("Invalid parent email").optional(),
  status: z
    .enum(["active", "inactive", "suspended", "graduated"] as const)
    .optional(),
});