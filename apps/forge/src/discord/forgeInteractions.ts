import {
  ChannelType,
  type ChatInputCommandInteraction,
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
  executeSetAnnouncementChannel,
  FORGE_CHANNEL_NOT_ENABLED_MESSAGE,
} from "@forge/application";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";
import {
  getStdbConnectionSnapshot,
  type QuestOfferCache,
} from "../bitcraft/index.js";
import {
  isUnknownInteractionError,
  requireManageGuild,
} from "@forge/discord-forge";
import {
  buildQuestBoardListComponents,
  questBoardEditPayload,
} from "./questBoardDiscord.js";

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
});

const claimDeps = (ctx: ForgeInteractionContext) => ({
  repo: ctx.repo,
  entityCacheRepo: ctx.entityCacheRepo,
});

const enableDeps = (ctx: ForgeInteractionContext) => ({
  repo: ctx.repo,
});

function forgeScopeChannelId(
  interaction: ChatInputCommandInteraction
): string | undefined {
  const ch = interaction.channel;
  if (!ch?.isTextBased() || !interaction.channelId) return undefined;
  return interaction.channelId;
}

export async function handleForgeInteraction(
  interaction: ChatInputCommandInteraction,
  ctx: ForgeInteractionContext
): Promise<void> {
  if (interaction.commandName !== "forge") return;

  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(true);

  if (!group && sub === "health") {
    const snap = getStdbConnectionSnapshot();
    const stdb = {
      connected: snap.connected,
      questProjectionReady: snap.questProjectionReady,
    };
    let content: string;
    try {
      const entityCacheCounts =
        await ctx.entityCacheRepo.getEntityCacheTableCounts();
      content = buildForgeHealthContent({ stdb, entityCacheCounts });
    } catch (e: unknown) {
      ctx.log.warn("forge health cache counts failed", e);
      content = [
        "**FORGE**",
        "",
        ...forgeHealthStdbMarkdownLines(stdb),
        "",
        "Could not load Postgres cache counts (check DB and logs).",
      ].join("\n");
    }
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content,
    });
    return;
  }

  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "Use `/forge` in a server (except `/forge health`, which works here).",
    });
    return;
  }

  const guildId = interaction.guildId;
  const forgeChannelId = forgeScopeChannelId(interaction);
  if (!forgeChannelId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command in a server text channel.",
    });
    return;
  }

  try {
    /**
     * Guild text-channel slashes are pre-deferred in `discordBot` before this runs.
     * Fallback defer keeps tests and any other entrypoints safe.
     */
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    if (!group && sub === "enable") {
      if (!requireManageGuild(interaction)) {
        await interaction.editReply({
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
      await interaction.editReply({ content });
      return;
    }

    if (!group && sub === "disable") {
      if (!requireManageGuild(interaction)) {
        await interaction.editReply({
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
      await interaction.editReply({ content });
      return;
    }

    /**
     * Never await the DB before the deferred ack above — only after deferReply.
     */
    const replyIfNotEnabledAfterDefer = async (): Promise<boolean> => {
      const ok = await ctx.repo.isForgeChannelEnabled(guildId, forgeChannelId);
      if (!ok) {
        await interaction.editReply({
          content: FORGE_CHANNEL_NOT_ENABLED_MESSAGE,
        });
      }
      return ok;
    };

    if (group === "quest") {
      if (!(await replyIfNotEnabledAfterDefer())) return;

      if (sub === "board") {
        const list = await executeQuestBoardList(
          guildId,
          forgeChannelId,
          {
            repo: ctx.repo,
            entityCacheRepo: ctx.entityCacheRepo,
            questOffers: ctx.questCache,
          },
          0
        );
        if (list.kind === "no_buildings" || list.kind === "no_offers") {
          await interaction.editReply(
            questBoardEditPayload(
              list.content,
              ctx.config.questBoardBannerUrl,
              []
            )
          );
          return;
        }
        await interaction.editReply(
          questBoardEditPayload(
            list.content,
            ctx.config.questBoardBannerUrl,
            buildQuestBoardListComponents(list, forgeChannelId) as InteractionEditReplyOptions["components"]
          )
        );
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
        await interaction.editReply({ content });
        return;
      }

      await interaction.editReply({
        content: "Unknown `/forge quest` subcommand.",
      });
      return;
    }

    if (group === "channel" && sub === "set") {
      if (!requireManageGuild(interaction)) {
        await interaction.editReply({
          content:
            "You need **Manage Server** to set announcement channels.",
        });
        return;
      }
      if (!(await replyIfNotEnabledAfterDefer())) return;

      const ch = interaction.options.getChannel("announcements");
      if (!ch) {
        const { content } = await executeSetAnnouncementChannel(
          guildId,
          forgeChannelId,
          null,
          { repo: ctx.repo }
        );
        await interaction.editReply({ content });
        return;
      }
      if (
        ch.type !== ChannelType.GuildText &&
        ch.type !== ChannelType.GuildAnnouncement
      ) {
        await interaction.editReply({
          content: "Pick a text or announcement channel.",
        });
        return;
      }
      const { content } = await executeSetAnnouncementChannel(
        guildId,
        forgeChannelId,
        ch.id,
        { repo: ctx.repo }
      );
      await interaction.editReply({ content });
      return;
    }

    if (!requireManageGuild(interaction)) {
      await interaction.editReply({
        content:
          "You need the **Manage Server** permission to configure FORGE monitors for this server.",
      });
      return;
    }

    if (group === "claim") {
      if (!(await replyIfNotEnabledAfterDefer())) return;

      if (sub === "list") {
        const { content } = await executeClaimList(
          guildId,
          forgeChannelId,
          claimDeps(ctx)
        );
        await interaction.editReply({ content });
        return;
      }

      const rawClaim = interaction.options.getString("claim_id", true);

      if (sub === "add") {
        const { content } = await executeClaimAdd(
          guildId,
          forgeChannelId,
          rawClaim,
          {
            repo: ctx.repo,
          }
        );
        await interaction.editReply({ content });
        return;
      }

      if (sub === "remove") {
        const { content } = await executeClaimRemove(
          guildId,
          forgeChannelId,
          rawClaim,
          {
            repo: ctx.repo,
          }
        );
        await interaction.editReply({ content });
        return;
      }

      await interaction.editReply({
        content: "Unknown `/forge claim` subcommand.",
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
        await interaction.editReply({ content });
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
        await interaction.editReply({ content });
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
        await interaction.editReply({ content });
        return;
      }

      await interaction.editReply({
        content: "Unknown `/forge building` subcommand.",
      });
      return;
    }

    await interaction.editReply({
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
        await interaction.editReply({ content: errContent });
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
