import type { LogSink } from "./logger";

/**
 * Emits each log entry as a single JSON line on stdout — the format log
 * shippers (Vector, Promtail → Loki, Fluent Bit, etc.) expect. Opt-in via
 * LOG_STREAM_JSON so local runs keep the human-readable console output only.
 */
export const jsonStdoutSink: LogSink = (entry) => {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
};
