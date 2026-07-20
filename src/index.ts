import "dotenv/config";

import { buildContainer } from "./bootstrap/build-container";
import { TOKENS } from "./core/di/tokens";
import { isLogSinkRegistrar } from "./core/logger/logger";
import { jsonStdoutSink } from "./core/logger/sinks";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection.", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception.", error);
});

const run = async (): Promise<void> => {
  const container = buildContainer();

  // Wire log transports: the in-process broadcaster (live streaming) and,
  // when LOG_STREAM_JSON is set, a JSON-lines stdout sink for log shippers.
  const logger = container.resolve(TOKENS.logger);
  if (isLogSinkRegistrar(logger)) {
    logger.registerSink(container.resolve(TOKENS.logBroadcaster).sink);
    if (container.resolve(TOKENS.config).logging.streamJson) {
      logger.registerSink(jsonStdoutSink);
    }
  }

  const bot = container.resolve(TOKENS.bot);

  const result = await bot.start();
  if (!result.ok) {
    console.error("Fatal startup error.", result.error);
    process.exit(1);
  }
};

void run().catch((error) => {
  console.error("Fatal startup error.", error);
  process.exit(1);
});
