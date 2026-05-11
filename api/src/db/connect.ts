import mongoose from "mongoose";
import { env } from "#config/env";

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDB = async () => {
  // If MongoDb is already connected, just return existing mongoose instance.
  if (mongoose.connection.readyState === mongoose.STATES.connected) {
    return mongoose;
  }

  /**
   * It handles multiple connection attempts. In the firs request, connectionPromise is null, so it will
   * start the connection with MongoDB. If the second and third request comes right after, during the connection.
   * Because connectionPromise is not null anymore, but is creating the connection. The following requests
   * wait for the first one to be fulfilled.
   */
  if (connectionPromise) {
    await connectionPromise;
    return mongoose;
  }

  connectionPromise = mongoose.connect(env.MONGO_URI, {
    dbName: env.DB_NAME,
    autoIndex: env.NODE_ENV !== "production",
  });

  try {
    await connectionPromise;
  } finally {
    const isConnected =
      Number(mongoose.connection.readyState) === Number(mongoose.STATES.connected);

    // Clears the connectionPromise if the connection fails. Needed to restart the connection.
    if (!isConnected) {
      connectionPromise = null;
    }
  }

  console.log(`Connected to MongoDB database "${env.DB_NAME}"`);
  return mongoose;
};
