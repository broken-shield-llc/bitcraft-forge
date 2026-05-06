import { describe, expect, it, vi, beforeEach } from "vitest";
import { MessageFlags, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";
import * as application from "@forge/application";
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
  const editReply = vi.fn().mockResolvedValue(undefined);
  const state = { deferred: false, replied: false };
  const deferReply = vi.fn().mockImplementation(async () => {
    state.deferred = true;
  });
  return {
    commandName: "forge",
    inGuild: () => true,
    guildId: "guild1",
    memberPermissions: {
      has: (bit: bigint) => bit === PermissionFlagsBits.ManageGuild,
    },
    get deferred() {
      return state.deferred;
    },
    get replied() {
      return state.replied;
    },
    options: {
      getSubcommandGroup: vi.fn().mockReturnValue(null),
      getSubcommand: vi.fn().mockReturnValue("health"),
    },
    reply,
    deferReply,
    editReply,
  } as unknown as ChatInputCommandInteraction;
}

function baseCtx(
  entityCacheRepo: EntityCacheRepository
): ForgeInteractionContext {
  return {
    config: { discordCommandName: "forge" } as ForgeConfig,
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

function createRewardsCommandInteraction(opts: {
  manageChannels?: boolean;
  manageGuild?: boolean;
}): ChatInputCommandInteraction {
  const reply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);
  const fetchReply = vi.fn().mockResolvedValue({ id: "m1" });
  const channelId = "chan1";
  const state = { deferred: false, replied: false };
  const deferReply = vi.fn().mockImplementation(async () => {
    state.deferred = true;
  });
  return {
    commandName: "forge",
    channelId,
    channel: { isTextBased: () => true },
    inGuild: () => true,
    guildId: "guild1",
    memberPermissions: {
      has: (bit: bigint) =>
        Boolean(
          (opts.manageGuild && bit === PermissionFlagsBits.ManageGuild) ||
            (opts.manageChannels && bit === PermissionFlagsBits.ManageChannels)
        ),
    },
    get deferred() {
      return state.deferred;
    },
    get replied() {
      return state.replied;
    },
    options: {
      getSubcommandGroup: vi.fn().mockReturnValue("quest"),
      getSubcommand: vi.fn().mockReturnValue("rewards"),
      getString: vi.fn(),
    },
    reply,
    deferReply,
    editReply,
    followUp,
    fetchReply,
  } as unknown as ChatInputCommandInteraction;
}

describe("handleForgeInteraction /forge health", () => {
  beforeEach(() => {
    stdbMocks.getStdbConnectionSnapshot.mockReturnValue({
      connected: true,
      questProjectionReady: true,
    });
  });

  it("defers then editReplies with full health body when cache counts succeed", async () => {
    const getEntityCacheTableCounts = vi.fn().mockResolvedValue(zeroCaches);
    const interaction = createHealthInteraction();
    await handleForgeInteraction(
      interaction,
      baseCtx({ getEntityCacheTableCounts } as unknown as EntityCacheRepository)
    );

    expect(stdbMocks.getStdbConnectionSnapshot).toHaveBeenCalled();
    expect(getEntityCacheTableCounts).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining("**FORGE**"),
    });
    const payload = vi.mocked(interaction.editReply).mock.calls[0][0] as {
      content: string;
    };
    expect(payload.content).toContain("SpacetimeDB connected: **true**");
    expect(payload.content).toContain("Quest projection ready: **true**");
    expect(payload.content).toContain("`item_desc`: **2**");
    expect(payload.content).toContain("registered **globally**");
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
    const payload = vi.mocked(interaction.editReply).mock.calls[0][0] as {
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
    const payload = vi.mocked(interaction.editReply).mock.calls[0][0] as {
      content: string;
    };
    expect(payload.content).toContain("SpacetimeDB connected: **false**");
    expect(payload.content).toContain("Quest projection ready: **false**");
  });
});

describe("handleForgeInteraction quest rewards", () => {
  it("denies without Manage Server or Manage Channels", async () => {
    const spy = vi.spyOn(application, "executeQuestRewardsList");
    const interaction = createRewardsCommandInteraction({});
    const isForgeChannelEnabled = vi.fn().mockResolvedValue(true);
    await handleForgeInteraction(interaction, {
      ...baseCtx({} as unknown as EntityCacheRepository),
      repo: { isForgeChannelEnabled } as unknown as GuildConfigRepository,
    });

    expect(isForgeChannelEnabled).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining("Manage Channels"),
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("calls executeQuestRewardsList and attaches picker components", async () => {
    const spy = vi.spyOn(application, "executeQuestRewardsList").mockResolvedValue({
      kind: "list",
      content: "**Stall rewards**\n…",
      totalShops: 1,
      totalOffers: 2,
      page: 0,
      totalPages: 1,
      shops: [{ shopEntityIdStr: "42", label: "Nick · 2 open orders", offerCount: 2 }],
      skippedLongIds: 0,
    });

    const interaction = createRewardsCommandInteraction({
      manageChannels: true,
    });
    const isForgeChannelEnabled = vi.fn().mockResolvedValue(true);
    await handleForgeInteraction(interaction, {
      ...baseCtx({} as unknown as EntityCacheRepository),
      repo: { isForgeChannelEnabled } as unknown as GuildConfigRepository,
    });

    expect(spy).toHaveBeenCalledWith(
      "guild1",
      "chan1",
      expect.any(Object),
      0
    );
    const editArg = vi.mocked(interaction.editReply).mock.calls[0]?.[0] as {
      content?: string;
      components?: unknown;
    };
    expect(editArg).toBeTruthy();
    expect(editArg.components).toBeTruthy();
    expect(editArg.content === "" || editArg.content).toBeDefined();
    expect(interaction.fetchReply).toHaveBeenCalled();
    spy.mockRestore();
  });
});
