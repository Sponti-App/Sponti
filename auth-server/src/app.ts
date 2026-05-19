import express from "express";
import cors from "cors";
import { authRoutes } from "#routes";
import { errorHandler, notFoundHandler } from "#middleware";
import { connectDB } from "#db";

const app = express();

// Allow the Next dev server and Capacitor WebView origins. Override via
// CORS_ORIGINS (comma-separated) when deploying.
const defaultOrigins = [
    "https://sponti-spa.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost",
    "http://192.168.178.185:3000",
    "capacitor://localhost",
    "ionic://localhost",
];
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
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

const PORT = Number(process.env.PORT) || 3001;
await connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
