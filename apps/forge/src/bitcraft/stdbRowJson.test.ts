import { describe, expect, it } from "vitest";
import { stdbRowToJson } from "./stdbRowJson.js";

describe("stdbRowToJson", () => {
  it("serializes bigint fields to decimal strings in JSON", () => {
    const row = { entityId: 12345678901234567890n, name: "x" };
    const j = stdbRowToJson(row);
    expect(j.entityId).toBe("12345678901234567890");
    expect(j.name).toBe("x");
  });

  it("round-trips nested objects", () => {
    const j = stdbRowToJson({ a: { b: 1n } });
    expect(j).toEqual({ a: { b: "1" } });
  });
});
