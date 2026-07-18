import "dotenv/config";

import { buildContainer } from "./bootstrap/build-container";
import { TOKENS } from "./core/di/tokens";

const run = async (): Promise<void> => {
  const container = buildContainer();
  const bot = container.resolve(TOKENS.bot);

  await bot.start();
};

void run().catch((error) => {
  console.error("Fatal startup error.", error);
  process.exit(1);
});
