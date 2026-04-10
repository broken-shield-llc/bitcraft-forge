import { describe, expect, it } from "vitest";
import { normalizeScopedId } from "./guildScopedId.js";

describe("normalizeScopedId", () => {
  it("trims and accepts non-empty strings", () => {
    expect(normalizeScopedId("  42  ")).toBe("42");
  });

  it("rejects empty and oversized", () => {
    expect(normalizeScopedId("   ")).toBeNull();
    expect(normalizeScopedId("x".repeat(129))).toBeNull();
  });
});
