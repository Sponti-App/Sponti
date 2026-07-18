import express from "express";
import cors from "cors";
import { authRoutes } from "#routes";
import { errorHandler, notFoundHandler } from "#middleware";
import { connectDB } from "#db";
import { env } from "#config/env";

const app = express();

const defaultOrigins = [
    "https://sponti-spa.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost",
    "capacitor://localhost",
    "ionic://localhost",
];
const allowedOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : defaultOrigins;

app.use(
    cors({
        origin: allowedOrigins,
        credentials: false,
    })
);
app.use(express.json());
app.use("/auth", authRoutes);

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "auth-server",
    });
});

app.use(notFoundHandler);
app.use(errorHandler);

await connectDB();

app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
});
