// Loaded with --import before any test file. Tests never touch a database:
// the real .env points at the shared Atlas database, so it is never read here,
// and every model call a test exercises is mocked. Mongoose command buffering
// is turned off so an unmocked call fails immediately instead of hanging.
import mongoose from "mongoose";

Object.assign(process.env, {
    NODE_ENV: "test",
    MONGO_URI: "mongodb://127.0.0.1:1/never-connected",
    DB_NAME: "sponti-test",
    ACCESS_JWT_SECRET: "test-access-secret",
    REFRESH_JWT_SECRET: "test-refresh-secret",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "test@example.com",
    CLOUDINARY_CLOUD_NAME: "test",
    CLOUDINARY_API_KEY: "test",
    CLOUDINARY_API_SECRET: "test",
    GOOGLE_CLIENT_ID: "test-google-client-id",
});

mongoose.set("bufferCommands", false);
