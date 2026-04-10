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
  forgeChannelNotEnabledMessage,
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
  discordCommandName: ctx.config.discordCommandName,
});

const claimDeps = (ctx: ForgeInteractionContext) => ({
  repo: ctx.repo,
  entityCacheRepo: ctx.entityCacheRepo,
  discordCommandName: ctx.config.discordCommandName,
});

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

export async function handleForgeInteraction(
  interaction: ChatInputCommandInteraction,
  ctx: ForgeInteractionContext
): Promise<void> {
  if (interaction.commandName !== ctx.config.discordCommandName) return;

  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(true);

  if (!group && sub === "health") {
    if (!(await deferEphemeralOrAbort(interaction))) return;

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
    await editReplyCatchUnknown(interaction, { content });
    return;
  }

  if (!interaction.inGuild() || !interaction.guildId) {
    if (!(await deferEphemeralOrAbort(interaction))) return;
    const cmd = ctx.config.discordCommandName;
    await editReplyCatchUnknown(interaction, {
      content: `Use \`/${cmd}\` in a server (except \`/${cmd} health\`, which works here).`,
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
      if (!(await replyIfNotEnabledAfterDefer())) return;

      if (sub === "board") {
        const list = await executeQuestBoardList(
          guildId,
          forgeChannelId,
          questBoardListDeps(ctx),
          0
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
        await editReplyCatchUnknown(interaction, { content });
        return;
      }

      await editReplyCatchUnknown(interaction, {
        content: `Unknown \`/${ctx.config.discordCommandName} quest\` subcommand.`,
      });
      return;
    }

    if (group === "channel" && sub === "set") {
      if (!requireManageGuild(interaction)) {
        await editReplyCatchUnknown(interaction, {
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
          {
            repo: ctx.repo,
            discordCommandName: ctx.config.discordCommandName,
          }
        );
        await editReplyCatchUnknown(interaction, { content });
        return;
      }
      if (
        ch.type !== ChannelType.GuildText &&
        ch.type !== ChannelType.GuildAnnouncement
      ) {
        await editReplyCatchUnknown(interaction, {
          content: "Pick a text or announcement channel.",
        });
        return;
      }
      const { content } = await executeSetAnnouncementChannel(
        guildId,
        forgeChannelId,
        ch.id,
        {
          repo: ctx.repo,
          discordCommandName: ctx.config.discordCommandName,
        }
      );
      await editReplyCatchUnknown(interaction, { content });
      return;
    }

    if (!requireManageGuild(interaction)) {
      await editReplyCatchUnknown(interaction, {
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
