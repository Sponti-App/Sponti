import { z } from "zod";

const requiredString = (name: string) =>
    z.preprocess((value) => value ?? "", z.string().min(1, `${name} is required`));

const optionalString = () =>
    z.preprocess(
        (value) => (value === "" || value == null ? undefined : value),
        z.string().min(1).optional()
    );

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    APP_URL: z.string().url("APP_URL must be a valid URL").default("http://localhost:3000"),
    CORS_ORIGINS: z.string().optional(),
    MONGO_URI: requiredString("MONGO_URI"),
    DB_NAME: requiredString("DB_NAME"),
    ACCESS_JWT_SECRET: requiredString("ACCESS_JWT_SECRET"),
    REFRESH_JWT_SECRET: requiredString("REFRESH_JWT_SECRET"),
    GOOGLE_CLIENT_ID: optionalString(),
    RESEND_API_KEY: requiredString("RESEND_API_KEY"),
    EMAIL_FROM: requiredString("EMAIL_FROM"),
    CLOUDINARY_CLOUD_NAME: requiredString("CLOUDINARY_CLOUD_NAME"),
    CLOUDINARY_API_KEY: requiredString("CLOUDINARY_API_KEY"),
    CLOUDINARY_API_SECRET: requiredString("CLOUDINARY_API_SECRET"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
    const details = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");

    throw new Error(`Invalid auth-server environment: ${details}`);
}

export const env = result.data;
