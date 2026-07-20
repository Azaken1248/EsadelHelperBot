import { EventEmitter } from "node:events";

import type { LogEntry, LogSink } from "./logger";

export type LogListener = (entry: LogEntry) => void;

/**
 * In-process fan-out for structured log entries (ARCHITECTURE.md §12 / logging
 * streaming). Register {@link sink} on the logger and every entry is buffered
 * (a bounded ring) and re-emitted to subscribers — the basis for a live log
 * feed (e.g. an SSE endpoint) without touching any logging call site.
 */
export class LogBroadcaster {
  private readonly emitter = new EventEmitter();
  private readonly buffer: LogEntry[] = [];

  constructor(private readonly bufferSize = 200) {
    // Unbounded listeners: an SSE endpoint may attach one per connected client.
    this.emitter.setMaxListeners(0);
  }

  /** Sink to register on the logger; feeds every entry into the broadcaster. */
  readonly sink: LogSink = (entry) => {
    this.publish(entry);
  };

  publish(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
    this.emitter.emit("log", entry);
  }

  /** Recent entries, oldest first — replayed to a client on connect. */
  recent(): LogEntry[] {
    return [...this.buffer];
  }

  /** Subscribe to live entries; returns an unsubscribe function. */
  subscribe(listener: LogListener): () => void {
    this.emitter.on("log", listener);
    return () => {
      this.emitter.off("log", listener);
    };
  }
}
