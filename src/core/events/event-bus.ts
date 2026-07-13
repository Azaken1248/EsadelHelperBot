import { EventEmitter } from "node:events";

/**
 * Decoupled Event Bus (ARCHITECTURE.md §1.2).
 *
 * A minimal typed wrapper over Node's {@link EventEmitter}. Producers and
 * consumers share an event map so payloads are checked at compile time, keeping
 * the Discord gateway, handlers, and services loosely coupled.
 */
export type EventMap = Record<string, unknown>;

export type EventListener<TPayload> = (payload: TPayload) => void;

export interface EventBus<TEvents extends EventMap> {
  on<K extends keyof TEvents & string>(event: K, listener: EventListener<TEvents[K]>): void;
  once<K extends keyof TEvents & string>(event: K, listener: EventListener<TEvents[K]>): void;
  off<K extends keyof TEvents & string>(event: K, listener: EventListener<TEvents[K]>): void;
  emit<K extends keyof TEvents & string>(event: K, payload: TEvents[K]): void;
  removeAllListeners(event?: keyof TEvents & string): void;
}

export const createEventBus = <TEvents extends EventMap>(): EventBus<TEvents> => {
  const emitter = new EventEmitter();

  return {
    on: (event, listener) => {
      emitter.on(event, listener as (...args: unknown[]) => void);
    },
    once: (event, listener) => {
      emitter.once(event, listener as (...args: unknown[]) => void);
    },
    off: (event, listener) => {
      emitter.off(event, listener as (...args: unknown[]) => void);
    },
    emit: (event, payload) => {
      emitter.emit(event, payload);
    },
    removeAllListeners: (event) => {
      emitter.removeAllListeners(event);
    },
  };
};
