import { describe, expect, it } from "vitest";
import {
  buildForgeHealthContent,
  type ForgeHealthViewInput,
} from "./forgeHealth.js";

const sampleStdb: ForgeHealthViewInput["stdb"] = {
  connected: true,
  questProjectionReady: true,
};

const sampleCounts: ForgeHealthViewInput["entityCacheCounts"] = {
  itemDesc: 100,
  claimState: 5,
  buildingState: 20,
  buildingDesc: 8,
  buildingNickname: 3,
  inventoryState: 50,
  userState: 12,
  playerUsername: 11,
};

describe("buildForgeHealthContent", () => {
  it("lists FORGE header, STDB lines, and each cache table with counts", () => {
    const content = buildForgeHealthContent({
      stdb: sampleStdb,
      entityCacheCounts: sampleCounts,
    });
    expect(content).toContain("**FORGE**");
    expect(content).toContain("SpacetimeDB connected: **true**");
    expect(content).toContain("Quest projection ready: **true**");
    expect(content).toContain("Postgres STDB entity cache rows");
    expect(content).toContain("`item_desc`: **100**");
    expect(content).toContain("`claim_state`: **5**");
    expect(content).toContain("`building_state`: **20**");
    expect(content).toContain("`building_desc`: **8**");
    expect(content).toContain("`building_nickname_state`: **3**");
    expect(content).toContain("`inventory_state`: **50**");
    expect(content).toContain("`user_state`: **12**");
    expect(content).toContain("`player_username_state`: **11**");
  });

  it("allows zero counts", () => {
    const zeros: ForgeHealthViewInput["entityCacheCounts"] = {
      itemDesc: 0,
      claimState: 0,
      buildingState: 0,
      buildingDesc: 0,
      buildingNickname: 0,
      inventoryState: 0,
      userState: 0,
      playerUsername: 0,
    };
    const content = buildForgeHealthContent({
      stdb: { connected: false, questProjectionReady: false },
      entityCacheCounts: zeros,
    });
    expect(content).toContain("SpacetimeDB connected: **false**");
    expect(content).toContain("Quest projection ready: **false**");
    expect(content).toContain("`item_desc`: **0**");
  });
});
