import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must contain at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must contain at least 32 characters"),

  JWT_ACCESS_EXPIRES_IN: z.string().min(1, "JWT_ACCESS_EXPIRES_IN is required"),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1, "JWT_REFRESH_EXPIRES_IN is required"),

  CLIENT_URL: z.string().url("CLIENT_URL must be a valid URL"),

  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  COOKIE_DOMAIN: z.string().trim().min(1).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables:");
  console.error(parsedEnv.error.format());
  process.exit(1);
}

const cookieSecure =
  parsedEnv.data.COOKIE_SECURE ??
  parsedEnv.data.NODE_ENV === "production";

if (parsedEnv.data.COOKIE_SAME_SITE === "none" && !cookieSecure) {
  console.error(
    "Invalid cookie configuration: COOKIE_SAME_SITE=none requires COOKIE_SECURE=true.",
  );
  process.exit(1);
}

const env = {
  port: parsedEnv.data.PORT,
  nodeEnv: parsedEnv.data.NODE_ENV,
  mongoUri: parsedEnv.data.MONGO_URI,
  jwtAccessSecret: parsedEnv.data.JWT_ACCESS_SECRET,
  jwtRefreshSecret: parsedEnv.data.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: parsedEnv.data.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: parsedEnv.data.JWT_REFRESH_EXPIRES_IN,
  clientUrl: parsedEnv.data.CLIENT_URL,
  cookieSameSite: parsedEnv.data.COOKIE_SAME_SITE,
  cookieSecure,
  cookieDomain: parsedEnv.data.COOKIE_DOMAIN,
};

export default env;
