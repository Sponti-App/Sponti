import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "#config/env";
import { connectDB } from "#db/connect";
import { errorHandler } from "#middleware/errorHandler";
import { notFound } from "#middleware/notFound";
import { apiRoutes } from "#routes/index";

export const createApp = () => {
  const app = express();

  if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }

  app.use(
    cors({
      origin: env.CLIENT_BASE_URL,
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
