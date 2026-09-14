import mongoose from "mongoose";
import { createDatabaseService, databaseService } from "../services/databaseService.js";
import { logger } from "../utils/logger.js";

export { createDatabaseService, databaseService, validateDatabaseConfiguration } from "../services/databaseService.js";

export const createMongoConnectionManager = (options = {}) => {
  const service = createDatabaseService({ mode: "mongo", vercel: "", ...options });
  return async () => {
    await service.ensureAvailable();
    return options.mongooseClient?.connection || mongoose.connection;
  };
};

export const connectDB = async () => {
  await databaseService.ensureAvailable();
  return mongoose.connection;
};

mongoose.connection.on("disconnected", () => logger.warn("database_disconnected"));
