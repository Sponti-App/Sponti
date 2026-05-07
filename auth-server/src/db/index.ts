import mongoose from "mongoose";

export const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
        throw new Error("MONGO_URI is not defined in environment variables", {
            cause: { status: 500 },
        });
    }
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB");
};