import { describe, expect, it, vi } from "vitest";
import {
  executeBuildingAdd,
  type BuildingCommandsDeps,
} from "./adminBuildings.js";

function baseBuildingDeps(
  overrides: Partial<BuildingCommandsDeps> & {
    repo?: Partial<BuildingCommandsDeps["repo"]>;
    entityCacheRepo?: Partial<BuildingCommandsDeps["entityCacheRepo"]>;
  } = {}
): BuildingCommandsDeps {
  const repo = {
    listBuildings: vi.fn(),
    addBuilding: vi.fn().mockResolvedValue("ok"),
    removeBuilding: vi.fn(),
    ...overrides.repo,
  };
  const entityCacheRepo = {
    getBuildingNicknames: vi.fn().mockResolvedValue(new Map()),
    getBuildingSummary: vi.fn(),
    getBuildingNickname: vi.fn().mockResolvedValue(undefined),
    inferBuildingKindFromCachedEntity: vi
      .fn()
      .mockResolvedValue("stall" as const),
    ...overrides.entityCacheRepo,
  };
  return { repo, entityCacheRepo };
}

describe("executeBuildingAdd", () => {
  it("rejects invalid building_id", async () => {
    const deps = baseBuildingDeps();
    const { content } = await executeBuildingAdd(
      "g1",
      { rawBuildingId: "", rawClaimId: null },
      deps
    );
    expect(content).toContain("Invalid `building_id`");
    expect(deps.repo.addBuilding).not.toHaveBeenCalled();
    expect(
      deps.entityCacheRepo.inferBuildingKindFromCachedEntity
    ).not.toHaveBeenCalled();
  });

  it("rejects building_id over max length", async () => {
    const deps = baseBuildingDeps();
    const { content } = await executeBuildingAdd(
      "g1",
      { rawBuildingId: "x".repeat(129), rawClaimId: null },
      deps
    );
    expect(content).toContain("Invalid `building_id`");
    expect(deps.repo.addBuilding).not.toHaveBeenCalled();
  });

  it("returns duplicate message when repo reports duplicate", async () => {
    const deps = baseBuildingDeps({
      repo: {
        listBuildings: vi.fn(),
        removeBuilding: vi.fn(),
        addBuilding: vi.fn().mockResolvedValue("duplicate"),
      },
    });
    const { content } = await executeBuildingAdd(
      "g1",
      { rawBuildingId: "99", rawClaimId: null },
      deps
    );
    expect(content).toContain("already monitored");
    expect(deps.repo.addBuilding).toHaveBeenCalledWith(
      "g1",
      "99",
      "stall",
      undefined
    );
  });

  it("rejects optional claim_id that is too long", async () => {
    const deps = baseBuildingDeps();
    const { content } = await executeBuildingAdd(
      "g1",
      { rawBuildingId: "10", rawClaimId: "y".repeat(129) },
      deps
    );
    expect(content).toContain("Invalid optional `claim_id`");
    expect(deps.repo.addBuilding).not.toHaveBeenCalled();
  });
});
