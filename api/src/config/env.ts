import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  DB_NAME: z.string().min(1, "DB_NAME is required"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_BASE_URL: z.string().url("CLIENT_BASE_URL must be a valid URL"),
  ACCESS_JWT_SECRET: z.string().min(1, "ACCESS_JWT_SECRET is required"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid API environment: ${details}`);
}

export const env = result.data;
