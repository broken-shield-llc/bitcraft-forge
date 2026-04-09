import { describe, expect, it } from "vitest";
import {
  formatBuildingKind,
  inferBuildingKindFromDescName,
  normalizeStoredBuildingKind,
  parseBuildingKind,
} from "./buildingKind.js";

describe("parseBuildingKind", () => {
  it("accepts stall and counter", () => {
    expect(parseBuildingKind("stall")).toBe("stall");
    expect(parseBuildingKind("COUNTER")).toBe("counter");
  });

  it("rejects invalid values", () => {
    expect(parseBuildingKind(null)).toBeNull();
    expect(parseBuildingKind("")).toBeNull();
    expect(parseBuildingKind("stand")).toBeNull();
    expect(parseBuildingKind("house")).toBeNull();
  });
});

describe("formatBuildingKind", () => {
  it("uses BitCraft display names", () => {
    expect(formatBuildingKind("stall")).toBe("Barter Stall");
    expect(formatBuildingKind("counter")).toBe("Barter Counter");
  });
});

describe("normalizeStoredBuildingKind", () => {
  it("maps legacy stand to counter", () => {
    expect(normalizeStoredBuildingKind("stand")).toBe("counter");
    expect(normalizeStoredBuildingKind("STAND")).toBe("counter");
  });
});

describe("inferBuildingKindFromDescName", () => {
  it("detects stall and counter from BitCraft-style names", () => {
    expect(inferBuildingKindFromDescName("Barter Stall")).toBe("stall");
    expect(inferBuildingKindFromDescName("Barter Counter")).toBe("counter");
  });

  it("maps legacy stand wording to counter", () => {
    expect(inferBuildingKindFromDescName("Barter Stand")).toBe("counter");
  });

  it("does not treat substrings of unrelated words as stand", () => {
    expect(inferBuildingKindFromDescName("understand")).toBeNull();
  });

  it("returns null when ambiguous or unknown", () => {
    expect(inferBuildingKindFromDescName("")).toBeNull();
    expect(inferBuildingKindFromDescName("Warehouse")).toBeNull();
  });
});
