import { describe, expect, it } from "vitest";
import { isPgUniqueViolation } from "./pgErrors.js";

/** Mimics drizzle-orm `DrizzleQueryError` wrapping a pg `23505`. */
function drizzleUniqueViolationError(): Error {
  const cause = Object.assign(new Error("duplicate key"), {
    code: "23505",
  });
  return Object.assign(new Error("Failed query: insert …"), { cause });
}

describe("isPgUniqueViolation", () => {
  it("returns true for direct pg-style error", () => {
    const e = Object.assign(new Error("dup"), { code: "23505" });
    expect(isPgUniqueViolation(e)).toBe(true);
  });

  it("returns true when 23505 is on Drizzle-wrapped cause chain", () => {
    expect(isPgUniqueViolation(drizzleUniqueViolationError())).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isPgUniqueViolation(new Error("nope"))).toBe(false);
    expect(isPgUniqueViolation({ code: "23503" })).toBe(false);
  });
});
