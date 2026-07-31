import { beforeEach, describe, expect, it, vi } from "vitest";

const mongooseMock = vi.hoisted(() => ({
  connect: vi.fn(),
  connection: { readyState: 0 },
  STATES: { connected: 1 },
}));
const circleCreateIndexesMock = vi.hoisted(() => vi.fn());

vi.mock("mongoose", () => ({
  default: mongooseMock,
}));

vi.mock("#config/env", () => ({
  env: {
    MONGO_URI: "mongodb://database.example.test:27017",
    DB_NAME: "sponti_test",
    NODE_ENV: "production",
  },
}));

vi.mock("#models/Circle", () => ({
  Circle: {
    createIndexes: circleCreateIndexesMock,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mongooseMock.connection.readyState = 0;
});

describe("connectDB", () => {
  it("makes connected-state callers await in-flight index provisioning", async () => {
    let resolveIndexes: (indexes: unknown[]) => void = () => undefined;
    const indexesPromise = new Promise<unknown[]>((resolve) => {
      resolveIndexes = resolve;
    });
    mongooseMock.connect.mockImplementation(async () => {
      mongooseMock.connection.readyState = mongooseMock.STATES.connected;
      return mongooseMock;
    });
    circleCreateIndexesMock.mockReturnValue(indexesPromise);
    const { connectDB } = await import("#db/connect");

    const firstConnection = connectDB();
    await vi.waitFor(() => {
      expect(circleCreateIndexesMock).toHaveBeenCalledOnce();
    });
    const secondConnection = connectDB();
    let secondResolved = false;
    void secondConnection.then(() => {
      secondResolved = true;
    });
    await Promise.resolve();

    expect(secondResolved).toBe(false);
    expect(mongooseMock.connect).toHaveBeenCalledOnce();
    expect(mongooseMock.connect).toHaveBeenCalledWith("mongodb://database.example.test:27017", {
      dbName: "sponti_test",
      autoIndex: false,
    });
    resolveIndexes([]);
    const [first, second] = await Promise.all([firstConnection, secondConnection]);

    expect(circleCreateIndexesMock).toHaveBeenCalledOnce();
    expect(first).toBe(mongooseMock);
    expect(second).toBe(mongooseMock);
  });

  it("retries index provisioning after a failure on an open connection", async () => {
    const indexError = new Error("index build failed");
    mongooseMock.connect.mockImplementation(async () => {
      mongooseMock.connection.readyState = mongooseMock.STATES.connected;
      return mongooseMock;
    });
    circleCreateIndexesMock.mockRejectedValueOnce(indexError).mockResolvedValueOnce([]);
    const { connectDB } = await import("#db/connect");

    await expect(connectDB()).rejects.toBe(indexError);
    await expect(connectDB()).resolves.toBe(mongooseMock);

    expect(mongooseMock.connect).toHaveBeenCalledOnce();
    expect(circleCreateIndexesMock).toHaveBeenCalledTimes(2);
  });
});
