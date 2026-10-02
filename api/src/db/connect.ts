import mongoose from "mongoose";
import { env } from "#config/env";
import { Block } from "#models/Block";
import { Circle } from "#models/Circle";

let initializationPromise: Promise<typeof mongoose> | null = null;
let indexesReady = false;

const connectAndEnsureIndexes = async () => {
  if (mongoose.connection.readyState !== mongoose.STATES.connected) {
    indexesReady = false;
    await mongoose.connect(env.MONGO_URI, {
      dbName: env.DB_NAME,
      autoIndex: env.NODE_ENV !== "production",
    });
  }

  // Production disables Mongoose auto-indexing, so explicitly provision the
  // API-owned Circle constraints and the Block indexes (#298) before the
  // server begins accepting requests. createIndexes only adds what is missing;
  // it never drops an index, so a { blockerId } index left from before #298 is
  // untouched (drop it by hand, see the PR for #298).
  await Promise.all([Circle.createIndexes(), Block.createIndexes()]);
  indexesReady = true;

  console.log(`Connected to MongoDB database "${env.DB_NAME}"`);
  return mongoose;
};

export const connectDB = async () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  if (mongoose.connection.readyState === mongoose.STATES.connected && indexesReady) {
    return mongoose;
  }

  const pendingInitialization = connectAndEnsureIndexes();
  initializationPromise = pendingInitialization;
  try {
    return await pendingInitialization;
  } catch (error) {
    indexesReady = false;
    throw error;
  } finally {
    if (initializationPromise === pendingInitialization) {
      initializationPromise = null;
    }
  }
};
