import { describe, expect, it } from "vitest";

import { hasPermissionBypass } from "../../src/security/permission-bypass";

describe("hasPermissionBypass", () => {
  it("returns true for configured bypass user", () => {
    expect(hasPermissionBypass("1213817849693478972")).toBe(true);
  });

  it("returns false for non-bypass user", () => {
    expect(hasPermissionBypass("non-bypass-user")).toBe(false);
  });
});
