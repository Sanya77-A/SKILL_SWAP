import { jest } from "@jest/globals";
import { createDatabaseService, createMongoConnectionManager, validateDatabaseConfiguration } from "../config/db.js";

describe("MongoDB serverless connection manager", () => {
  test("shares one pending connection across concurrent cold-start requests", async () => {
    let resolveConnection;
    const pending = new Promise((resolve) => { resolveConnection = resolve; });
    const connection = { readyState: 0, name: "test" };
    const mongooseClient = {
      connection,
      connect: jest.fn(async () => {
        await pending;
        connection.readyState = 1;
      }),
    };
    const manager = createMongoConnectionManager({
      mongooseClient,
      uri: "mongodb://example.invalid/test",
      log: { info: jest.fn(), error: jest.fn() },
    });

    const first = manager();
    const second = manager();
    expect(mongooseClient.connect).toHaveBeenCalledTimes(1);
    resolveConnection();
    await expect(Promise.all([first, second])).resolves.toEqual([connection, connection]);
    await expect(manager()).resolves.toBe(connection);
    expect(mongooseClient.connect).toHaveBeenCalledTimes(1);
  });

  test("backs off after a failure and allows a later retry", async () => {
    let currentTime = 1_000;
    const connection = { readyState: 0, name: "test" };
    const mongooseClient = {
      connection,
      connect: jest.fn()
        .mockRejectedValueOnce(new Error("temporary failure"))
        .mockImplementationOnce(async () => { connection.readyState = 1; }),
    };
    const manager = createMongoConnectionManager({
      mongooseClient,
      uri: "mongodb://example.invalid/test",
      log: { info: jest.fn(), error: jest.fn() },
      now: () => currentTime,
    });

    await expect(manager()).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE", statusCode: 503 });
    await expect(manager()).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE", statusCode: 503 });
    expect(mongooseClient.connect).toHaveBeenCalledTimes(1);
    currentTime += 30_001;
    await expect(manager()).resolves.toBe(connection);
    expect(mongooseClient.connect).toHaveBeenCalledTimes(2);
  });

  test("rejects missing and Vercel-local Mongo configuration without connecting", async () => {
    expect(validateDatabaseConfiguration({ mode: "mongo", uri: "" })).toMatchObject({ valid: false, code: "DATABASE_CONFIGURATION_ERROR" });
    expect(validateDatabaseConfiguration({ mode: "mongo", uri: "mongodb://127.0.0.1:27017/skillswap", vercel: "1" })).toMatchObject({ valid: false, code: "DATABASE_CONFIGURATION_ERROR" });

    const mongooseClient = { connection: { readyState: 0 }, connect: jest.fn() };
    const service = createDatabaseService({ mode: "mongo", uri: "mongodb://localhost:27017/skillswap", vercel: "1", mongooseClient });
    await expect(service.ensureAvailable()).rejects.toMatchObject({ code: "DATABASE_CONFIGURATION_ERROR", statusCode: 503 });
    expect(mongooseClient.connect).not.toHaveBeenCalled();
  });

  test("demo mode reports no persistence and never initializes Mongoose", async () => {
    const mongooseClient = { connection: { readyState: 0 }, connect: jest.fn() };
    const service = createDatabaseService({ mode: "demo", uri: "", vercel: "1", mongooseClient });
    await expect(service.ensureAvailable()).resolves.toMatchObject({ mode: "demo", available: true, persistence: false, database: "demo" });
    expect(mongooseClient.connect).not.toHaveBeenCalled();
  });

  test("opens a new connection after a previously warm connection disconnects", async () => {
    const connection = { readyState: 0, name: "test" };
    const mongooseClient = {
      connection,
      connect: jest.fn(async () => { connection.readyState = 1; }),
    };
    const manager = createMongoConnectionManager({
      mongooseClient,
      uri: "mongodb://example.invalid/test",
      log: { info: jest.fn(), error: jest.fn() },
    });

    await manager();
    connection.readyState = 0;
    await manager();
    expect(mongooseClient.connect).toHaveBeenCalledTimes(2);
  });
});
