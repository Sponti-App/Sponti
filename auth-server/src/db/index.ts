import mongoose from "mongoose";

export const connectDB = async () => {
    const mongoURI = process.env.MONGO_URI;
    const dbName = process.env.DB_NAME;

    if (!mongoURI) {
        throw new Error("MONGO_URI is not defined in environment variables", {
            cause: { status: 500 },
        });
    }

    if (!dbName) {
        throw new Error("DB_NAME is not defined in environment variables", {
            cause: { status: 500 },
        });
    }

    await mongoose.connect(mongoURI, {
        dbName,
        autoIndex: process.env.NODE_ENV !== "production",
    });

    console.log(`Connected to MongoDB database "${dbName}"`);
};
