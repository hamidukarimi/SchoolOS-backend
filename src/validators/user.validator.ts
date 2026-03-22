import { z } from "zod";

export const registerSchema = z.object({
  firstname: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters"),

  lastname: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must be at most 50 characters"),

    username: z
    .string()
    .min(2, "username must be at least 2 characters")
    .max(50, "Name must be at most 50 characters"),

  email: z
    .string()
    .email("Invalid email format"),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),

  birthday: z
  .string()
  .optional()
  .transform((val) => (val ? new Date(val) : undefined))
  .refine((val) => !val || !isNaN(val.getTime()), {
    message: "Invalid date format",
  }),
    
    gender: z
    .string()
    .optional(),

    location: z.object({
      city: z.string().max(100, "City must be at most 100 characters").optional(),
      country: z.string().max(100, "Country must be at most 100 characters").optional(),
    }).optional(),

    avatar: z.string().optional(),
    
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, "Current password is required"),

  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters"),
}).strict();

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;






export const updateProfileSchema = z.object({
  firstname: z.string().min(2).max(50).optional(),
  lastname:  z.string().min(2).max(50).optional(),
  username:  z.string().min(2).max(50).optional(),
  avatar:    z.string().url().optional(),
  birthday:  z.string().optional(),
  gender:    z.enum(["male", "female", "other"]).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" },
);

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;