import mongoose from "mongoose";

import type { Logger } from "../core/logger/logger";

export const connectToDatabase = async (mongoUri: string, logger: Logger): Promise<void> => {
  await mongoose.connect(mongoUri);
  logger.info("Connected to MongoDB.");
};
