import express from "express";
import cors from "cors";
import { authRoutes } from "#routes";
import { createAuthRateLimits, errorHandler, notFoundHandler } from "#middleware";
import { connectDB } from "#db";
import { env } from "#config/env";

const app = express();

// The auth-server sits behind one proxy hop (Caddy, deploy/netcup). Trusting it
// makes req.ip the real client address, which the rate limits key on (#535).
app.set("trust proxy", 1);

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

// #535: the public auth routes are rate-limited before validation, so
// malformed bodies count too. Limits live in middleware/rateLimit.ts.
const rateLimits = createAuthRateLimits();
app.use("/auth/login", rateLimits.login);
app.use("/auth/register", rateLimits.register);
app.use("/auth/google", rateLimits.google);
app.use("/auth/forgot-password", rateLimits.forgotPassword);
app.use("/auth/reset-password", rateLimits.resetPassword);
app.use("/auth/refresh", rateLimits.refresh);
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
