import mongoose from "mongoose";
import { env } from "#config/env";
import { Block } from "#models/Block";
import { Circle } from "#models/Circle";
import { EventInviteLink } from "#models/EventInviteLink";
import { PendingEventInvite } from "#models/PendingEventInvite";

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
  // untouched (drop it by hand, see the PR for #298). A flare's invite link and
  // the invites waiting on a host (#616) rely on their unique indexes (one link
  // per flare, one token, one wait per guest and flare), and the token lookup is
  // that same index, so those are provisioned here too.
  await Promise.all([
    Circle.createIndexes(),
    Block.createIndexes(),
    EventInviteLink.createIndexes(),
    PendingEventInvite.createIndexes(),
  ]);
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
