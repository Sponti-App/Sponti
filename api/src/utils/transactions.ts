import mongoose, { type ClientSession } from "mongoose";

type TransactionCallback<T> = (session?: ClientSession) => Promise<T>;

const afterCommitQueues = new WeakMap<ClientSession, Array<() => unknown>>();

// Runs `fn` once the transaction `session` belongs to has committed, or now
// when there's no transaction. For side effects outside the database (web
// push, #639) that must not fire for a write that rolls back or is retried.
export const runAfterCommit = (session: ClientSession | undefined, fn: () => unknown) => {
  const queue = session ? afterCommitQueues.get(session) : undefined;
  if (queue) queue.push(fn);
  else void fn();
};

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
      // A retried attempt starts over, so drop what the failed one queued.
      afterCommitQueues.set(session, []);
      result = await callback(session);
    });

    for (const fn of afterCommitQueues.get(session) ?? []) void fn();
    return result as T;
  } catch (error) {
    if (isTransactionUnsupportedError(error)) {
      console.warn("MongoDB transactions are unavailable; retrying operation without a session.");
      return callback();
    }

    throw error;
  } finally {
    afterCommitQueues.delete(session);
    await session.endSession();
  }
};
