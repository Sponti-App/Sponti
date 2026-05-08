import mongoose, { type ClientSession } from "mongoose";

type TransactionCallback<T> = (session?: ClientSession) => Promise<T>;

const isTransactionUnsupportedError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Transaction numbers are only allowed") ||
    error.message.includes("replica set member or mongos")
  );
};

export const withTransactionFallback = async <T>(callback: TransactionCallback<T>): Promise<T> => {
  const session = await mongoose.startSession();

  try {
    let result: T | undefined;

    await session.withTransaction(async () => {
      result = await callback(session);
    });

    return result as T;
  } catch (error) {
    if (isTransactionUnsupportedError(error)) {
      console.warn("MongoDB transactions are unavailable; retrying operation without a session.");
      return callback();
    }

    throw error;
  } finally {
    await session.endSession();
  }
};
