import { describe, expect, it, vi, beforeEach } from "vitest";
import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";
import type { QuestOfferCache } from "../bitcraft/index.js";
import { handleForgeInteraction, type ForgeInteractionContext } from "./forgeInteractions.js";

const stdbMocks = vi.hoisted(() => ({
  getStdbConnectionSnapshot: vi.fn(() => ({
    connected: true,
    questProjectionReady: true,
  })),
}));

vi.mock("../bitcraft/index.js", () => ({
  getStdbConnectionSnapshot: stdbMocks.getStdbConnectionSnapshot,
}));

const zeroCaches = {
  itemDesc: 2,
  claimState: 0,
  buildingState: 0,
  buildingDesc: 0,
  buildingNickname: 0,
  inventoryState: 0,
  userState: 0,
  playerUsername: 0,
};

function createHealthInteraction(): ChatInputCommandInteraction {
  const reply = vi.fn().mockResolvedValue(undefined);
  return {
    commandName: "forge",
    options: {
      getSubcommandGroup: vi.fn().mockReturnValue(null),
      getSubcommand: vi.fn().mockReturnValue("health"),
    },
    reply,
  } as unknown as ChatInputCommandInteraction;
}

function baseCtx(
  entityCacheRepo: EntityCacheRepository
): ForgeInteractionContext {
  return {
    config: {} as ForgeConfig,
    log: {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger,
    repo: {} as GuildConfigRepository,
    entityCacheRepo,
    questCache: {} as QuestOfferCache,
  };
}

describe("handleForgeInteraction /forge health", () => {
  beforeEach(() => {
    stdbMocks.getStdbConnectionSnapshot.mockReturnValue({
      connected: true,
      questProjectionReady: true,
    });
  });

  it("replies with full health body when cache counts succeed (no defer — health uses reply only)", async () => {
    const getEntityCacheTableCounts = vi.fn().mockResolvedValue(zeroCaches);
    const interaction = createHealthInteraction();
    await handleForgeInteraction(
      interaction,
      baseCtx({ getEntityCacheTableCounts } as unknown as EntityCacheRepository)
    );

    expect(stdbMocks.getStdbConnectionSnapshot).toHaveBeenCalled();
    expect(getEntityCacheTableCounts).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
      content: expect.stringContaining("**FORGE**"),
    });
    const payload = vi.mocked(interaction.reply).mock.calls[0][0] as {
      content: string;
    };
    expect(payload.content).toContain("SpacetimeDB connected: **true**");
    expect(payload.content).toContain("Quest projection ready: **true**");
    expect(payload.content).toContain("`item_desc`: **2**");
  });

  it("replies with STDB lines and error copy when cache counts throw", async () => {
    const getEntityCacheTableCounts = vi
      .fn()
      .mockRejectedValue(new Error("db down"));
    const warn = vi.fn();
    const interaction = createHealthInteraction();
    await handleForgeInteraction(interaction, {
      ...baseCtx({ getEntityCacheTableCounts } as unknown as EntityCacheRepository),
      log: { warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() } as unknown as Logger,
    });

    expect(warn).toHaveBeenCalledWith(
      "forge health cache counts failed",
      expect.any(Error)
    );
    const payload = vi.mocked(interaction.reply).mock.calls[0][0] as {
      content: string;
    };
    expect(payload.content).toContain("SpacetimeDB connected: **true**");
    expect(payload.content).toContain("Could not load Postgres cache counts");
  });

  it("reflects disconnected snapshot from getStdbConnectionSnapshot", async () => {
    stdbMocks.getStdbConnectionSnapshot.mockReturnValue({
      connected: false,
      questProjectionReady: false,
    });
    const getEntityCacheTableCounts = vi.fn().mockResolvedValue(zeroCaches);
    const interaction = createHealthInteraction();
    await handleForgeInteraction(
      interaction,
      baseCtx({ getEntityCacheTableCounts } as unknown as EntityCacheRepository)
    );
    const payload = vi.mocked(interaction.reply).mock.calls[0][0] as {
      content: string;
    };
    expect(payload.content).toContain("SpacetimeDB connected: **false**");
    expect(payload.content).toContain("Quest projection ready: **false**");
  });
});
