import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StringSelectMenuInteraction } from "discord.js";
import * as app from "@forge/application";
import { forgeQbShopCustomId } from "./questBoardDiscord.js";
import { handleForgeQuestBoardSelect } from "./forgeQuestBoardInteractions.js";
import {
  clearQuestBoardListRequireQuery,
  setQuestBoardListRequireQuery,
} from "./questBoardRequireState.js";
import type { ForgeInteractionContext } from "./forgeInteractions.js";

vi.mock("@forge/application", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@forge/application")>();
  return {
    ...mod,
    executeQuestBoardShopDetail: vi.fn().mockResolvedValue({
      kind: "ok" as const,
      content: "**Quest board**\n\ndone",
      offerPage: 0,
      totalOfferPages: 1,
      offerCount: 1,
    }),
  };
});

const FORGE_CH = "100000000000000001";
const MSG_ID = "msg-questboard-select-test-1";
const GUILD = "g999";

function buildSelectInteraction(shopId: string): StringSelectMenuInteraction {
  return {
    customId: forgeQbShopCustomId(FORGE_CH),
    values: [shopId],
    message: { id: MSG_ID },
    guildId: GUILD,
    channelId: FORGE_CH,
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as unknown as StringSelectMenuInteraction;
}

function buildCtx(
  isEnabled: boolean
): ForgeInteractionContext {
  return {
    config: { discordCommandName: "forge", questBoardBannerUrl: undefined } as ForgeInteractionContext["config"],
    log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as ForgeInteractionContext["log"],
    repo: {
      isForgeChannelEnabled: vi.fn().mockResolvedValue(isEnabled),
    } as unknown as ForgeInteractionContext["repo"],
    entityCacheRepo: {} as ForgeInteractionContext["entityCacheRepo"],
    questCache: {} as ForgeInteractionContext["questCache"],
  };
}

describe("handleForgeQuestBoardSelect", () => {
  beforeEach(() => {
    clearQuestBoardListRequireQuery(MSG_ID);
    vi.mocked(app.executeQuestBoardShopDetail).mockClear();
  });

  it("passes the stored list requireQuery into executeQuestBoardShopDetail", async () => {
    setQuestBoardListRequireQuery(MSG_ID, "InGoT");
    const fn = vi.mocked(app.executeQuestBoardShopDetail);
    await handleForgeQuestBoardSelect(
      buildSelectInteraction("10"),
      buildCtx(true),
      FORGE_CH
    );
    expect(fn).toHaveBeenCalledWith(
      GUILD,
      FORGE_CH,
      "10",
      expect.objectContaining({ discordCommandName: "forge" }),
      0,
      "InGoT"
    );
  });

  it("passes null when no requireQuery is stored (plain board list)", async () => {
    const fn = vi.mocked(app.executeQuestBoardShopDetail);
    await handleForgeQuestBoardSelect(
      buildSelectInteraction("10"),
      buildCtx(true),
      FORGE_CH
    );
    expect(fn).toHaveBeenCalledWith(
      GUILD,
      FORGE_CH,
      "10",
      expect.anything(),
      0,
      null
    );
  });
});
