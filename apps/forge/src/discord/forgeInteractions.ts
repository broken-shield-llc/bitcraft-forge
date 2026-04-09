import {
  ChannelType,
  type ChatInputCommandInteraction,
  type InteractionEditReplyOptions,
  MessageFlags,
} from "discord.js";
import {
  buildForgeHealthContent,
  executeBuildingAdd,
  executeBuildingList,
  executeBuildingRemove,
  executeClaimAdd,
  executeClaimList,
  executeClaimRemove,
  executeForgeDisable,
  executeForgeEnable,
  executeQuestBoardList,
  executeQuestComplete,
  executeQuestLeaderboard,
  executeSetAnnouncementChannel,
  FORGE_CHANNEL_NOT_ENABLED_MESSAGE,
} from "@forge/application";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";
import { getStdbHealth, type QuestOfferCache } from "../bitcraft/index.js";
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
    const content = buildForgeHealthContent({
      bitcraftWsUri: ctx.config.bitcraftWsUri,
      bitcraftModule: ctx.config.bitcraftModule,
      bitcraftJwtSet: Boolean(ctx.config.bitcraftJwt?.trim()),
      nodeVersion: process.version,
      health: getStdbHealth(),
    });
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
    if (!group && sub === "enable") {
      if (!requireManageGuild(interaction)) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content:
            "You need **Manage Server** to enable BitCraft Forge for a channel.",
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content:
            "You need **Manage Server** to disable BitCraft Forge for a channel.",
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { content } = await executeForgeDisable(
        guildId,
        forgeChannelId,
        enableDeps(ctx)
      );
      await interaction.editReply({ content });
      return;
    }

    /**
     * Discord requires an initial response within ~3s. Never await the DB before
     * deferReply on paths that will defer — slow Postgres caused 10062 Unknown interaction.
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
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
          }
        );
        await interaction.editReply({ content });
        return;
      }

      if (sub === "complete") {
        const rawBuilding = interaction.options.getString("building_id", true);
        const rawQuest = interaction.options.getString("quest_entity_id", true);
        const { content } = await executeQuestComplete(
          {
            discordGuildId: guildId,
            forgeChannelId,
            discordUserId: interaction.user.id,
            rawBuildingId: rawBuilding,
            rawQuestEntityId: rawQuest,
          },
          { repo: ctx.repo }
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
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content:
            "You need **Manage Server** to set announcement channels.",
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content:
          "You need the **Manage Server** permission to configure FORGE monitors for this server.",
      });
      return;
    }

    if (group === "claim") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
        const rawOptClaim = interaction.options.getString("claim_id");
        const { content } = await executeBuildingAdd(
          guildId,
          forgeChannelId,
          {
            rawBuildingId: rawBuilding,
            rawClaimId: rawOptClaim,
          },
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

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Unknown FORGE command.",
    });
  } catch (e: unknown) {
    ctx.log.error("forge command failed", e);
    if (isUnknownInteractionError(e)) {
      ctx.log.warn(
        "Discord interaction expired or invalid (10062); often caused by replying after 3s without defer"
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
