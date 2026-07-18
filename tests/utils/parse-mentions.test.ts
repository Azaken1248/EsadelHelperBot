import { describe, expect, it } from "vitest";

import { parseUserMentions } from "../../src/utils/parse-mentions";

describe("parseUserMentions", () => {
  it("extracts ids from mention syntax", () => {
    const ids = parseUserMentions("<@123456789012345678> <@!987654321098765432>");
    expect(ids).toEqual(["123456789012345678", "987654321098765432"]);
  });

  it("extracts bare snowflake ids", () => {
    const ids = parseUserMentions("123456789012345678 and 987654321098765432");
    expect(ids).toEqual(["123456789012345678", "987654321098765432"]);
  });

  it("deduplicates repeated ids", () => {
    const ids = parseUserMentions("<@123456789012345678> <@123456789012345678>");
    expect(ids).toEqual(["123456789012345678"]);
  });

  it("does not double-count a mention as a bare id", () => {
    const ids = parseUserMentions("<@123456789012345678>");
    expect(ids).toEqual(["123456789012345678"]);
  });

  it("returns an empty array when there are no ids", () => {
    expect(parseUserMentions("just some text")).toEqual([]);
    expect(parseUserMentions("")).toEqual([]);
  });
});
