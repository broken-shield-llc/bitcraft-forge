import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  type InteractionEditReplyOptions,
  MessageFlags,
} from "discord.js";
import {
  buildForgeHealthContent,
  forgeHealthStdbMarkdownLines,
  executeBuildingAdd,
  executeBuildingList,
  executeBuildingRemove,
  executeClaimAdd,
  executeClaimList,
  executeClaimRemove,
  executeForgeDisable,
  executeForgeEnable,
  executeQuestBoardList,
  executeQuestLeaderboard,
  executeQuestLeaderboardReset,
  executeQuestScoringSet,
  executeQuestScoringShow,
  executeSetQuestAnnouncementTarget,
  forgeChannelNotEnabledMessage,
  type QuestAnnouncementTargetKey,
} from "@forge/application";
import {
  QUEST_LEADERBOARD_SCORING_MODES,
  type QuestLeaderboardScoringMode,
} from "@forge/domain";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";
import {
  getStdbConnectionSnapshot,
  type QuestOfferCache,
} from "../bitcraft/index.js";
import {
  isQuestAnnouncementChannelType,
  isUnknownInteractionError,
  requireForgeChannelManage,
  requireManageGuild,
} from "@forge/discord-forge";
import {
  buildQuestBoardListComponents,
  questBoardEditPayload,
} from "./questBoardDiscord.js";
import { setQuestBoardListRequireQuery } from "./questBoardRequireState.js";

export type ForgeInteractionContext = {
  config: ForgeConfig;
  log: Logger;
  repo: GuildConfigRepository;
  entityCacheRepo: EntityCacheRepository;
  questCache: QuestOfferCache;
};

const buildingDeps = (ctx: ForgeInteractionContext) => ({
  repo: ctx.repo,
  entityCacheRepo: ctx.entityCacheRepo,
  discordCommandName: ctx.config.discordCommandName,
});

const claimDeps = (ctx: ForgeInteractionContext) => ({
  repo: ctx.repo,
  entityCacheRepo: ctx.entityCacheRepo,
  discordCommandName: ctx.config.discordCommandName,
});

const LEADERBOARD_DESC_MAX = 4096;
const LEADERBOARD_EMBED_COLOR = 0x2b2d31;

function stripLeaderboardTitleLine(text: string): string {
  return text.replace(/^\*\*Quest Leaderboard\*\*\s*\n?/u, "");
}

function questLeaderboardEditPayload(
  fullContent: string,
  bannerUrl: string | undefined
): InteractionEditReplyOptions {
  const trimmed = bannerUrl?.trim();
  if (!trimmed) return { content: fullContent };

  let body = stripLeaderboardTitleLine(fullContent);
  if (body.length > LEADERBOARD_DESC_MAX) {
    body = body.slice(0, Math.max(0, LEADERBOARD_DESC_MAX - 1)) + "…";
  }
  const bannerEmbed = new EmbedBuilder()
    .setColor(LEADERBOARD_EMBED_COLOR)
    .setImage(trimmed);
  const textEmbed = new EmbedBuilder()
    .setColor(LEADERBOARD_EMBED_COLOR)
    .setDescription(body);
  return { content: "", embeds: [bannerEmbed, textEmbed] };
}

const enableDeps = (ctx: ForgeInteractionContext) => ({
  repo: ctx.repo,
  discordCommandName: ctx.config.discordCommandName,
});

const questBoardListDeps = (ctx: ForgeInteractionContext) => ({
  repo: ctx.repo,
  entityCacheRepo: ctx.entityCacheRepo,
  questOffers: ctx.questCache,
  discordCommandName: ctx.config.discordCommandName,
});

/** Ack within Discord’s ~3s window; false if the interaction is already invalid (10062). */
async function deferEphemeralOrAbort(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return true;
  } catch (e: unknown) {
    if (isUnknownInteractionError(e)) return false;
    throw e;
  }
}

async function editReplyCatchUnknown(
  interaction: ChatInputCommandInteraction,
  options: InteractionEditReplyOptions
): Promise<void> {
  try {
    await interaction.editReply(options);
  } catch (e: unknown) {
    if (isUnknownInteractionError(e)) return;
    throw e;
  }
}

function forgeScopeChannelId(
  interaction: ChatInputCommandInteraction
): string | undefined {
  const ch = interaction.channel;
  if (!ch?.isTextBased() || !interaction.channelId) return undefined;
  return interaction.channelId;
}

const QUEST_SCORING_WEIGHT_OPTION_KEYS: [option: string, jsonKey: string][] =
  [
    ["untiered", "untiered"],
    ["tier_1", "1"],
    ["tier_2", "2"],
    ["tier_3", "3"],
    ["tier_4", "4"],
    ["tier_5", "5"],
    ["tier_6", "6"],
    ["tier_7", "7"],
    ["tier_8", "8"],
    ["tier_9", "9"],
    ["tier_10", "10"],
  ];

function collectQuestScoringWeightsPatch(
  interaction: ChatInputCommandInteraction
): Partial<Record<string, number>> | undefined {
  const patch: Partial<Record<string, number>> = {};
  for (const [opt, key] of QUEST_SCORING_WEIGHT_OPTION_KEYS) {
    const v = interaction.options.getInteger(opt, false);
    if (v != null) patch[key] = v;
  }
  return Object.keys(patch).length > 0 ? patch : undefined;
}

export async function handleForgeInteraction(
  interaction: ChatInputCommandInteraction,
  ctx: ForgeInteractionContext
): Promise<void> {
  if (interaction.commandName !== ctx.config.discordCommandName) return;

  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(true);

  if (!group && sub === "health") {
    if (!(await deferEphemeralOrAbort(interaction))) return;

    if (!interaction.inGuild() || !interaction.guildId) {
      const cmd = ctx.config.discordCommandName;
      await editReplyCatchUnknown(interaction, {
        content: `Use \`/${cmd} health\` in a server text channel.`,
      });
      return;
    }
    if (!requireManageGuild(interaction)) {
      await editReplyCatchUnknown(interaction, {
        content: "You need **Manage Server** to view Forge health.",
      });
      return;
    }

    const snap = getStdbConnectionSnapshot();
    const stdb = {
      connected: snap.connected,
      questProjectionReady: snap.questProjectionReady,
    };
    const discordMeta = {
      commandName: ctx.config.discordCommandName,
      slashGuildRegistrationId: ctx.config.discordGuildId,
    };
    let content: string;
    try {
      const entityCacheCounts =
        await ctx.entityCacheRepo.getEntityCacheTableCounts();
      content = buildForgeHealthContent({
        stdb,
        entityCacheCounts,
        discordMeta,
      });
    } catch (e: unknown) {
      ctx.log.warn("forge health cache counts failed", e);
      content = buildForgeHealthContent({
        stdb,
        entityCacheCounts: {
          itemDesc: 0,
          claimState: 0,
          buildingState: 0,
          buildingDesc: 0,
          buildingNickname: 0,
          inventoryState: 0,
          userState: 0,
          playerUsername: 0,
        },
        cacheCountsErrorMessage:
          "Could not load Postgres cache counts (check DB and logs).",
        discordMeta,
      });
    }
    await editReplyCatchUnknown(interaction, { content });
    return;
  }

  if (!interaction.inGuild() || !interaction.guildId) {
    if (!(await deferEphemeralOrAbort(interaction))) return;
    const cmd = ctx.config.discordCommandName;
    await editReplyCatchUnknown(interaction, {
      content: `Use \`/${cmd}\` in a server text channel.`,
    });
    return;
  }

  const guildId = interaction.guildId;
  const forgeChannelId = forgeScopeChannelId(interaction);
  if (!forgeChannelId) {
    if (!(await deferEphemeralOrAbort(interaction))) return;
    await editReplyCatchUnknown(
      interaction,
      {
        content: "Use this command in a server text channel.",
      }
    );
    return;
  }

  try {
    if (!(await deferEphemeralOrAbort(interaction))) return;

    if (!group && sub === "enable") {
      if (!requireManageGuild(interaction)) {
        await editReplyCatchUnknown(interaction, {
          content:
            "You need **Manage Server** to enable BitCraft Forge for a channel.",
        });
        return;
      }
      const { content } = await executeForgeEnable(
        guildId,
        forgeChannelId,
        enableDeps(ctx)
      );
      await editReplyCatchUnknown(interaction, { content });
      return;
    }

    if (!group && sub === "disable") {
      if (!requireManageGuild(interaction)) {
        await editReplyCatchUnknown(interaction, {
          content:
            "You need **Manage Server** to disable BitCraft Forge for a channel.",
        });
        return;
      }
      const { content } = await executeForgeDisable(
        guildId,
        forgeChannelId,
        enableDeps(ctx)
      );
      await editReplyCatchUnknown(interaction, { content });
      return;
    }

    const replyIfNotEnabledAfterDefer = async (): Promise<boolean> => {
      const ok = await ctx.repo.isForgeChannelEnabled(guildId, forgeChannelId);
      if (!ok) {
        await editReplyCatchUnknown(interaction, {
          content: forgeChannelNotEnabledMessage(ctx.config.discordCommandName),
        });
      }
      return ok;
    };

    if (group === "quest") {
      if (sub === "reset-leaderboard") {
        if (!requireForgeChannelManage(interaction)) {
          await editReplyCatchUnknown(interaction, {
            content:
              "You need **Manage Server** or **Manage Channels** to reset the quest leaderboard for this channel.",
          });
          return;
        }
        if (!(await replyIfNotEnabledAfterDefer())) return;
        const { content } = await executeQuestLeaderboardReset(
          guildId,
          forgeChannelId,
          { repo: ctx.repo }
        );
        await editReplyCatchUnknown(interaction, { content });
        return;
      }

      if (!(await replyIfNotEnabledAfterDefer())) return;

      if (sub === "board") {
        const list = await executeQuestBoardList(
          guildId,
          forgeChannelId,
          questBoardListDeps(ctx),
          0,
          null
        );
        if (list.kind === "no_buildings" || list.kind === "no_offers") {
          await editReplyCatchUnknown(
            interaction,
            questBoardEditPayload(
              list.content,
              ctx.config.questBoardBannerUrl,
              []
            )
          );
          const m = await interaction.fetchReply();
          setQuestBoardListRequireQuery(m.id, null);
          return;
        }
        await editReplyCatchUnknown(
          interaction,
          questBoardEditPayload(
            list.content,
            ctx.config.questBoardBannerUrl,
            buildQuestBoardListComponents(list, forgeChannelId) as InteractionEditReplyOptions["components"]
          )
        );
        const m = await interaction.fetchReply();
        setQuestBoardListRequireQuery(m.id, null);
        return;
      }

      if (sub === "search") {
        const queryRaw = interaction.options.getString("query", true).trim();
        if (queryRaw.length === 0) {
          await editReplyCatchUnknown(interaction, {
            content: "Search query cannot be empty.",
          });
          return;
        }
        const list = await executeQuestBoardList(
          guildId,
          forgeChannelId,
          questBoardListDeps(ctx),
          0,
          queryRaw
        );
        if (list.kind === "no_buildings" || list.kind === "no_offers") {
          await editReplyCatchUnknown(
            interaction,
            questBoardEditPayload(
              list.content,
              ctx.config.questBoardBannerUrl,
              []
            )
          );
          const m = await interaction.fetchReply();
          setQuestBoardListRequireQuery(m.id, queryRaw);
          return;
        }
        await editReplyCatchUnknown(
          interaction,
          questBoardEditPayload(
            list.content,
            ctx.config.questBoardBannerUrl,
            buildQuestBoardListComponents(list, forgeChannelId) as InteractionEditReplyOptions["components"]
          )
        );
        const m = await interaction.fetchReply();
        setQuestBoardListRequireQuery(m.id, queryRaw);
        return;
      }

      if (sub === "leaderboard") {
        const { content } = await executeQuestLeaderboard(
          guildId,
          forgeChannelId,
          {
            repo: ctx.repo,
            entityCacheRepo: ctx.entityCacheRepo,
          }
        );
        await editReplyCatchUnknown(
          interaction,
          questLeaderboardEditPayload(
            content,
            ctx.config.questLeaderboardBannerUrl
          )
        );
        return;
      }

      if (sub === "scoring") {
        if (!requireForgeChannelManage(interaction)) {
          await editReplyCatchUnknown(interaction, {
            content:
              "You need **Manage Server** or **Manage Channels** to view or set quest leaderboard scoring for this channel.",
          });
          return;
        }
        const action = interaction.options.getString("action", true);
        if (action === "show") {
          const { content } = await executeQuestScoringShow(
            guildId,
            forgeChannelId,
            {
              repo: ctx.repo,
              entityCacheRepo: ctx.entityCacheRepo,
            }
          );
          await editReplyCatchUnknown(interaction, { content });
          return;
        }
        const modeRaw = interaction.options.getString("mode");
        const known = QUEST_LEADERBOARD_SCORING_MODES as readonly string[];
        if (!modeRaw || !known.includes(modeRaw)) {
          await editReplyCatchUnknown(interaction, {
            content:
              "When **action** is `set`, choose a **mode** from the command options (required).",
          });
          return;
        }
        const weightsPatch = collectQuestScoringWeightsPatch(interaction);
        const { content } = await executeQuestScoringSet(
          guildId,
          forgeChannelId,
          {
            mode: modeRaw as QuestLeaderboardScoringMode,
            weightsPatch,
          },
          {
            repo: ctx.repo,
            entityCacheRepo: ctx.entityCacheRepo,
          }
        );
        await editReplyCatchUnknown(interaction, { content });
        return;
      }

      await editReplyCatchUnknown(interaction, {
        content: `Unknown \`/${ctx.config.discordCommandName} quest\` subcommand.`,
      });
      return;
    }

    if (group === "channel" && sub === "set") {
      if (!requireForgeChannelManage(interaction)) {
        await editReplyCatchUnknown(interaction, {
          content:
            "You need **Manage Server** or **Manage Channels** to set where barter and quest messages are posted.",
        });
        return;
      }
      if (!(await replyIfNotEnabledAfterDefer())) return;

      const targetRaw = interaction.options.getString("target") ?? "default";
      const target = targetRaw as QuestAnnouncementTargetKey;
      const ch = interaction.options.getChannel("channel");
      if (!ch) {
        const { content } = await executeSetQuestAnnouncementTarget(
          guildId,
          forgeChannelId,
          target,
          null,
          {
            repo: ctx.repo,
            discordCommandName: ctx.config.discordCommandName,
          }
        );
        await editReplyCatchUnknown(interaction, { content });
        return;
      }
      if (!isQuestAnnouncementChannelType(ch.type)) {
        await editReplyCatchUnknown(interaction, {
          content:
            "Pick a text channel, announcement channel, or thread the bot can post in.",
        });
        return;
      }
      const { content } = await executeSetQuestAnnouncementTarget(
        guildId,
        forgeChannelId,
        target,
        ch.id,
        {
          repo: ctx.repo,
          discordCommandName: ctx.config.discordCommandName,
        }
      );
      await editReplyCatchUnknown(interaction, { content });
      return;
    }

    if (group === "claim" || group === "building") {
      if (!requireForgeChannelManage(interaction)) {
        await editReplyCatchUnknown(interaction, {
          content:
            "You need **Manage Server** or **Manage Channels** to configure claim and building watches for this channel.",
        });
        return;
      }
    }

    if (group === "claim") {
      if (!(await replyIfNotEnabledAfterDefer())) return;

      if (sub === "list") {
        const { content } = await executeClaimList(
          guildId,
          forgeChannelId,
          claimDeps(ctx)
        );
        await editReplyCatchUnknown(interaction, { content });
        return;
      }

      const rawClaim = interaction.options.getString("claim_id", true);

      if (sub === "add") {
        const { content } = await executeClaimAdd(
          guildId,
          forgeChannelId,
          rawClaim,
          claimDeps(ctx)
        );
        await editReplyCatchUnknown(interaction, { content });
        return;
      }

      if (sub === "remove") {
        const { content } = await executeClaimRemove(
          guildId,
          forgeChannelId,
          rawClaim,
          claimDeps(ctx)
        );
        await editReplyCatchUnknown(interaction, { content });
        return;
      }

      await editReplyCatchUnknown(interaction, {
        content: `Unknown \`/${ctx.config.discordCommandName} claim\` subcommand.`,
      });
      return;
    }

    if (group === "building") {
      if (!(await replyIfNotEnabledAfterDefer())) return;

      if (sub === "list") {
        const { content } = await executeBuildingList(
          guildId,
          forgeChannelId,
          buildingDeps(ctx)
        );
        await editReplyCatchUnknown(interaction, { content });
        return;
      }

      if (sub === "add") {
        const rawBuilding = interaction.options.getString("building_id", true);
        const { content } = await executeBuildingAdd(
          guildId,
          forgeChannelId,
          { rawBuildingId: rawBuilding },
          buildingDeps(ctx)
        );
        await editReplyCatchUnknown(interaction, { content });
        return;
      }

      if (sub === "remove") {
        const rawBuilding = interaction.options.getString("building_id", true);
        const { content } = await executeBuildingRemove(
          guildId,
          forgeChannelId,
          rawBuilding,
          buildingDeps(ctx)
        );
        await editReplyCatchUnknown(interaction, { content });
        return;
      }

      await editReplyCatchUnknown(interaction, {
        content: `Unknown \`/${ctx.config.discordCommandName} building\` subcommand.`,
      });
      return;
    }

    await editReplyCatchUnknown(interaction, {
      content: "Unknown FORGE command.",
    });
  } catch (e: unknown) {
    ctx.log.error("forge command failed", e);
    if (isUnknownInteractionError(e)) {
      ctx.log.warn(
        "Discord interaction expired or invalid (10062); token may have expired before defer, or callback already used"
      );
      return;
    }
    const msg =
      e instanceof Error ? e.message : "Unexpected error while using the database.";
    const errContent = `Error: ${msg}`;
    try {
      if (interaction.deferred) {
        await editReplyCatchUnknown(interaction, { content: errContent });
      } else if (interaction.replied) {
        await interaction.followUp({
          flags: MessageFlags.Ephemeral,
          content: errContent,
        });
      } else {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: errContent,
        });
      }
    } catch (e2: unknown) {
      if (!isUnknownInteractionError(e2)) {
        ctx.log.warn("forge interaction error reply failed", e2);
      }
    }
  }
}
