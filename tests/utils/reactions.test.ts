import { describe, expect, it, vi } from "vitest";

import { reactSafely } from "../../src/utils/reactions";

describe("reactSafely", () => {
  it("reacts with each emoji in order", async () => {
    const react = vi.fn().mockResolvedValue(undefined);
    await reactSafely({ react }, ["🎀", "✨"]);
    expect(react).toHaveBeenNthCalledWith(1, "🎀");
    expect(react).toHaveBeenNthCalledWith(2, "✨");
  });

  it("no-ops on an unreactable target", async () => {
    await expect(reactSafely(undefined, ["🎀"])).resolves.toBeUndefined();
    await expect(reactSafely({}, ["🎀"])).resolves.toBeUndefined();
  });

  it("swallows reaction failures without throwing", async () => {
    const react = vi.fn().mockRejectedValue(new Error("Missing Permissions"));
    await expect(reactSafely({ react }, ["🎀", "✨"])).resolves.toBeUndefined();
    // stops after the first failure
    expect(react).toHaveBeenCalledTimes(1);
  });
});
