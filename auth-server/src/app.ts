import express from "express";
import { authRoutes } from "#routes";
import { errorHandler, notFoundHandler } from "#middleware";
import { connectDB } from "#db";

const app = express();

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

const PORT = Number(process.env.PORT) || 3000;
await connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
