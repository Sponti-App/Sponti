import express from "express";
import { authRoutes } from "#routes";

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "auth-server",
    });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});