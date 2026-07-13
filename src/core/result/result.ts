/**
 * System-wide unified Result type (ARCHITECTURE.md §1.2).
 *
 * Expected failures are returned as typed values rather than thrown, so the
 * compiler forces every caller to discriminate on the `ok` flag before reading
 * `value` or `error`.
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Narrowing helper for the success branch. */
export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } =>
  result.ok;

/** Narrowing helper for the failure branch. */
export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } =>
  !result.ok;
