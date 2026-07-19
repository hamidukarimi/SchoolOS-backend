import mongoose from "mongoose";
import { z } from "zod";
import connectDB from "../config/db.js";
import User from "../models/User.model.js";

const adminEnvSchema = z
  .object({
    ADMIN_NAME: z.string().trim().min(1, "ADMIN_NAME is required"),
    ADMIN_USERNAME: z.string().trim().min(2).max(50).optional(),
    ADMIN_EMAIL: z
      .string()
      .trim()
      .email("ADMIN_EMAIL must be a valid email")
      .transform((value) => value.toLowerCase()),
    ADMIN_PASSWORD: z
      .string()
      .min(12, "ADMIN_PASSWORD must contain at least 12 characters"),
  })
  .superRefine((data, context) => {
    const nameParts = data.ADMIN_NAME.split(/\s+/);
    if (
      nameParts.length < 2 ||
      nameParts.some((part) => part.length < 2)
    ) {
      context.addIssue({
        code: "custom",
        path: ["ADMIN_NAME"],
        message:
          "ADMIN_NAME must include a first name and last name of at least 2 characters each",
      });
    }
  });

const seedAdmin = async (): Promise<void> => {
  const parsed = adminEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid administrator configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`- ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Administrator was not created");
  }

  await connectDB();

  const existingUser = await User.findOne({ email: parsed.data.ADMIN_EMAIL });

  if (existingUser) {
    if (existingUser.role === "admin") {
      console.log(`Administrator already exists: ${existingUser.email}`);
      return;
    }

    existingUser.role = "admin";
    await existingUser.save();
    console.log(`Existing user promoted to administrator: ${existingUser.email}`);
    return;
  }

  const nameParts = parsed.data.ADMIN_NAME.split(/\s+/);
  const firstname = nameParts.shift();
  const lastname = nameParts.join(" ");
  const emailUsername = parsed.data.ADMIN_EMAIL.split("@")[0];

  if (!firstname || !lastname || !emailUsername) {
    throw new Error("Unable to derive administrator profile fields");
  }

  const administrator = await User.create({
    firstname,
    lastname,
    username: parsed.data.ADMIN_USERNAME ?? emailUsername,
    email: parsed.data.ADMIN_EMAIL,
    password: parsed.data.ADMIN_PASSWORD,
    role: "admin",
    isVerified: true,
  });

  console.log(`Administrator created successfully: ${administrator.email}`);
};

void seedAdmin()
  .catch((error: unknown) => {
    console.error(
      "Admin seeding failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
