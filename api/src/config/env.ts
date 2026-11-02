import { z } from "zod";

const googleMapsApiKey =
  process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  DB_NAME: z.string().min(1, "DB_NAME is required"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_BASE_URL: z.string().url("CLIENT_BASE_URL must be a valid URL"),
  CORS_ORIGINS: z.string().optional(),
  ACCESS_JWT_SECRET: z.string().min(1, "ACCESS_JWT_SECRET is required"),
  // Used by the /maps/route proxy to call Google Routes API server-side so the
  // key never ships to the SPA. Optional: when unset, the route endpoint
  // returns 503 and the SPA falls back to drawing a straight line.
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  // Web push (#639). Optional: without both keys, push is off. Generate a pair
  // with `npx web-push generate-vapid-keys`. The subject is a mailto: or https
  // URL push services can reach the sender at; it defaults to CLIENT_BASE_URL.
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
});

const result = envSchema.safeParse({
  ...process.env,
  GOOGLE_MAPS_API_KEY: googleMapsApiKey,
});

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid API environment: ${details}`);
}

export const env = result.data;
