import { z } from "zod";

export const createStaffSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  staffId: z.string().min(1, "Staff ID is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female"] as const, {
    message: "Gender must be male or female",
  }),
  phone: z.string().optional(),
  address: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  position: z.string().min(1, "Position is required"),
  salary: z.number().min(0, "Salary must be at least 0"),
  joinDate: z.string().optional(),
  contractType: z
    .enum(["full-time", "part-time", "contract"] as const)
    .optional(),
  status: z
    .enum(["active", "inactive", "suspended", "terminated"] as const)
    .optional(),
});

export const updateStaffSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female"] as const).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  department: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
  salary: z.number().min(0).optional(),
  joinDate: z.string().optional(),
  contractType: z
    .enum(["full-time", "part-time", "contract"] as const)
    .optional(),
  status: z
    .enum(["active", "inactive", "suspended", "terminated"] as const)
    .optional(),
});