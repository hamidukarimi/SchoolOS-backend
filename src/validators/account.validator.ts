import { z } from "zod";

const locationSchema = z
  .object({
    city: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
  })
  .strict();

const birthdaySchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid date format" })
  .transform((value) => new Date(value));

export const accountListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  role: z.enum(["user", "admin"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const createAccountSchema = z
  .object({
    firstname: z.string().trim().min(2).max(50),
    lastname: z.string().trim().min(2).max(50),
    username: z.string().trim().min(2).max(50),
    email: z.string().trim().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    birthday: birthdaySchema.optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    location: locationSchema.optional(),
    role: z.enum(["user", "admin"]).default("user"),
  })
  .strict();

export const updateAccountSchema = z
  .object({
    firstname: z.string().trim().min(2).max(50).optional(),
    lastname: z.string().trim().min(2).max(50).optional(),
    username: z.string().trim().min(2).max(50).optional(),
    email: z.string().trim().email("Invalid email format").optional(),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
    birthday: birthdaySchema.optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    location: locationSchema.optional(),
    role: z.enum(["user", "admin"]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field is required" });

export type AccountListQuery = z.infer<typeof accountListQuerySchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
