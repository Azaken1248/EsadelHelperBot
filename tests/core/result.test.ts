import { describe, expect, it } from "vitest";

import { err, isErr, isOk, ok } from "../../src/core/result/result";

describe("Result", () => {
  it("ok wraps a value", () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it("err wraps an error", () => {
    const error = new Error("boom");
    const result = err(error);
    expect(result).toEqual({ ok: false, error });
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });

  it("isOk narrows to the success branch", () => {
    const result = ok("value");
    if (isOk(result)) {
      expect(result.value).toBe("value");
    } else {
      throw new Error("expected ok");
    }
  });

  it("isErr narrows to the failure branch", () => {
    const result = err("failure");
    if (isErr(result)) {
      expect(result.error).toBe("failure");
    } else {
      throw new Error("expected err");
    }
  });
});
