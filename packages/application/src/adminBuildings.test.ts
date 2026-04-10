import { describe, expect, it, vi } from "vitest";
import {
  executeBuildingAdd,
  executeBuildingList,
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
    getBuildingNickname: vi.fn().mockResolvedValue(undefined),
    getClaimName: vi.fn().mockResolvedValue(undefined),
    inferBuildingKindFromCachedEntity: vi
      .fn()
      .mockResolvedValue("stall" as const),
    ...overrides.entityCacheRepo,
  };
  return { repo, entityCacheRepo };
}

describe("executeBuildingList", () => {
  it("formats rows with nickname, kind, and claim name", async () => {
    const repo = {
      listBuildings: vi.fn().mockResolvedValue([
        {
          buildingId: "b1",
          kind: "stall" as const,
          claimId: "claim-1",
        },
      ]),
      addBuilding: vi.fn(),
      removeBuilding: vi.fn(),
    };
    const entityCacheRepo = {
      getBuildingNicknames: vi
        .fn()
        .mockResolvedValue(new Map([["b1", "My Stall"]])),
      getBuildingNickname: vi.fn(),
      getClaimName: vi.fn().mockResolvedValue("Shimmer Bay"),
      inferBuildingKindFromCachedEntity: vi.fn(),
    };
    const { content } = await executeBuildingList("g1", "c1", {
      repo,
      entityCacheRepo,
    });
    expect(content).toContain(
      "* **My Stall** (`b1`) [Barter Stall] in **Shimmer Bay**"
    );
  });
});

describe("executeBuildingAdd", () => {
  it("rejects invalid building_id", async () => {
    const deps = baseBuildingDeps();
    const { content } = await executeBuildingAdd(
      "g1",
      "c1",
      { rawBuildingId: "" },
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
      "c1",
      { rawBuildingId: "x".repeat(129) },
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
      "c1",
      { rawBuildingId: "99" },
      deps
    );
    expect(content).toContain("already monitored");
    expect(deps.repo.addBuilding).toHaveBeenCalledWith(
      "g1",
      "c1",
      "99",
      "stall",
      undefined
    );
  });

  it("success message uses nickname, id, and kind in brackets", async () => {
    const deps = baseBuildingDeps({
      entityCacheRepo: {
        ...baseBuildingDeps().entityCacheRepo,
        getBuildingNickname: vi.fn().mockResolvedValue("Shop One"),
      },
    });
    const { content } = await executeBuildingAdd(
      "g1",
      "c1",
      { rawBuildingId: "42" },
      deps
    );
    expect(content).toBe(
      "Now monitoring **Shop One** (`42`) [Barter Stall]"
    );
  });
});
