import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "#config/env";
import { connectDB } from "#db/connect";
import { requireAuth } from "#middleware/auth";
import { errorHandler } from "#middleware/errorHandler";
import { notFound } from "#middleware/notFound";
import { apiRoutes } from "#routes/index";

const defaultDevelopmentOrigins = [
  "https://sponti-spa.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
];

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

export function getAllowedCorsOrigins(): string[] {
  const configuredOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",")
    : [env.CLIENT_BASE_URL];
  const origins =
    env.NODE_ENV === "development" && !env.CORS_ORIGINS
      ? [...configuredOrigins, ...defaultDevelopmentOrigins]
      : configuredOrigins;

  return Array.from(new Set(origins.map(normalizeOrigin).filter(Boolean)));
}

export const createApp = () => {
  const app = express();

  if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }

  app.use(
    cors({
      origin: getAllowedCorsOrigins(),
      credentials: false,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      data: {
        status: "ok",
        service: "sponti-api",
      },
    });
  });

  app.use("/api/v1", requireAuth);

  app.use("/api/v1", async (_req, _res, next) => {
    try {
      await connectDB();
      next();
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/v1", apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
export default app;
