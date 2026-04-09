import { describe, expect, it } from "vitest";
import { formatBuildingDisplayLabel } from "./buildingLabel.js";

describe("formatBuildingDisplayLabel", () => {
  it("prefers nickname with entity id in backticks", () => {
    expect(formatBuildingDisplayLabel("42", "  Stall One  ")).toBe(
      "**Stall One** (`42`)"
    );
  });

  it("falls back to entity id only when no nickname", () => {
    expect(formatBuildingDisplayLabel("99", undefined)).toBe("`99`");
    expect(formatBuildingDisplayLabel("99", "   ")).toBe("`99`");
  });
});
