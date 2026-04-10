import { describe, expect, it } from "vitest";
import { normalizeRegionConnectionInfoStub } from "./normalizeRegionRow.js";

describe("normalizeRegionConnectionInfoStub", () => {
  it("returns null when id is missing or invalid", () => {
    expect(normalizeRegionConnectionInfoStub({})).toBeNull();
    expect(normalizeRegionConnectionInfoStub({ id: "nope" })).toBeNull();
  });

  it("maps id and label", () => {
    expect(
      normalizeRegionConnectionInfoStub({ id: 7, label: "Alpha" })
    ).toEqual({ id: 7, label: "Alpha" });
  });

  it("falls back to name then synthetic label", () => {
    expect(normalizeRegionConnectionInfoStub({ id: 2, name: "Beta" })).toEqual({
      id: 2,
      label: "Beta",
    });
    expect(normalizeRegionConnectionInfoStub({ id: 3 })).toEqual({
      id: 3,
      label: "region-3",
    });
  });
});
