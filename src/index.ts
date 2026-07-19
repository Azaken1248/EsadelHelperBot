import "dotenv/config";

import { buildContainer } from "./bootstrap/build-container";
import { TOKENS } from "./core/di/tokens";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection.", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception.", error);
});

const run = async (): Promise<void> => {
  const container = buildContainer();
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
