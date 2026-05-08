import mongoose from "mongoose";
import { env } from "#config/env";

export const connectDB = async () => {
  await mongoose.connect(env.MONGO_URI, {
    dbName: env.DB_NAME,
    autoIndex: env.NODE_ENV !== "production",
  });

  console.log(`Connected to MongoDB database "${env.DB_NAME}"`);
};
