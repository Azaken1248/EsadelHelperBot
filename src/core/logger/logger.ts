export interface Logger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export type LogSink = (entry: LogEntry) => void | Promise<void>;

export interface LogSinkRegistrar {
  registerSink(sink: LogSink): void;
}

const hasOwnRegisterSink = (value: unknown): value is { registerSink: unknown } => {
  return typeof value === "object" && value !== null && "registerSink" in value;
};

export const isLogSinkRegistrar = (logger: Logger): logger is Logger & LogSinkRegistrar => {
  if (!hasOwnRegisterSink(logger)) {
    return false;
  }

  return typeof logger.registerSink === "function";
};

const serializeMetadata = (metadata?: Record<string, unknown>): string => {
  if (!metadata) {
    return "";
  }

  try {
    return ` ${JSON.stringify(metadata)}`;
  } catch {
    return " [metadata-serialization-failed]";
  }
};

const formatLog = (
  entry: LogEntry,
): string => {
  const metadataText = serializeMetadata(entry.metadata);
  return `[${entry.timestamp}] [${entry.scope}] [${entry.level}] ${entry.message}${metadataText}`;
};

export const createLogger = (scope: string): Logger & LogSinkRegistrar => {
  const sinks: LogSink[] = [];

  const emit = (
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void => {
    const baseEntry = {
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
    };

    const entry: LogEntry = metadata
      ? {
          ...baseEntry,
          metadata,
        }
      : baseEntry;

    const formatted = formatLog(entry);

    if (level === "INFO") {
      console.log(formatted);
    } else if (level === "WARN") {
      console.warn(formatted);
    } else {
      console.error(formatted);
    }

    for (const sink of sinks) {
      void Promise.resolve(sink(entry)).catch((error) => {
        const sinkErrorMessage =
          error instanceof Error ? error.message : "Unknown log sink failure.";

        const sinkErrorEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: "ERROR",
          scope,
          message: "Log sink dispatch failed.",
          metadata: {
            sinkErrorMessage,
          },
        };

        console.error(formatLog(sinkErrorEntry));
      });
    }
  };

  return {
    info: (message, metadata) => {
      emit("INFO", message, metadata);
    },
    warn: (message, metadata) => {
      emit("WARN", message, metadata);
    },
    error: (message, metadata) => {
      emit("ERROR", message, metadata);
    },
    registerSink: (sink) => {
      sinks.push(sink);
    },
  };
};
