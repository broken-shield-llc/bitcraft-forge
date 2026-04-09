import {
  type ButtonInteraction,
  type InteractionEditReplyOptions,
  MessageFlags,
  type StringSelectMenuInteraction,
} from "discord.js";
import {
  executeQuestBoardList,
  executeQuestBoardShopDetail,
  FORGE_CHANNEL_NOT_ENABLED_MESSAGE,
} from "@forge/application";
import { isUnknownInteractionError } from "@forge/discord-forge";
import type { ForgeInteractionContext } from "./forgeInteractions.js";
import {
  buildQuestBoardDetailComponents,
  buildQuestBoardListComponents,
  forgeQbShopCustomId,
  type ParsedQuestBoardCustomId,
  questBoardEditPayload,
} from "./questBoardDiscord.js";

function questBoardDeps(ctx: ForgeInteractionContext) {
  return {
    repo: ctx.repo,
    entityCacheRepo: ctx.entityCacheRepo,
    questOffers: ctx.questCache,
  } as const;
}

async function editReplyPlain(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  content: string,
  components: InteractionEditReplyOptions["components"] = []
): Promise<void> {
  await interaction.editReply({
    content,
    embeds: [],
    components,
  });
}

async function editReplyQuestBoard(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  fullContent: string,
  ctx: ForgeInteractionContext,
  components?: InteractionEditReplyOptions["components"]
): Promise<void> {
  await interaction.editReply(
    questBoardEditPayload(
      fullContent,
      ctx.config.questBoardBannerUrl,
      components
    )
  );
}

async function requireQuestBoardChannel(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  ctx: ForgeInteractionContext,
  forgeChannelId: string
): Promise<{ guildId: string } | null> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await editReplyPlain(interaction, "Use this in a server.", []);
    return null;
  }
  if (interaction.channelId !== forgeChannelId) {
    await editReplyPlain(
      interaction,
      "This quest board control belongs to another channel.",
      []
    );
    return null;
  }
  const enabled = await ctx.repo.isForgeChannelEnabled(guildId, forgeChannelId);
  if (!enabled) {
    await editReplyPlain(interaction, FORGE_CHANNEL_NOT_ENABLED_MESSAGE, []);
    return null;
  }
  return { guildId };
}

export async function handleForgeQuestBoardSelect(
  interaction: StringSelectMenuInteraction,
  ctx: ForgeInteractionContext,
  forgeChannelId: string
): Promise<void> {
  if (interaction.customId !== forgeQbShopCustomId(forgeChannelId)) return;

  try {
    await interaction.deferUpdate();
  } catch (e: unknown) {
    if (isUnknownInteractionError(e)) {
      ctx.log.debug(
        "quest board select: interaction unknown before defer (expired, duplicate ack, or client lag)"
      );
      return;
    }
    ctx.log.error("forge quest board select defer failed", e);
    return;
  }

  try {
    const scope = await requireQuestBoardChannel(interaction, ctx, forgeChannelId);
    if (!scope) return;

    const shopId = interaction.values[0];
    if (!shopId || shopId.length > 100) {
      await editReplyPlain(interaction, "Invalid shop selection.", []);
      return;
    }

    const d = await executeQuestBoardShopDetail(
      scope.guildId,
      forgeChannelId,
      shopId,
      questBoardDeps(ctx)
    );
    if (d.kind === "not_found") {
      await editReplyPlain(interaction, d.content, []);
      return;
    }
    await editReplyQuestBoard(
      interaction,
      d.content,
      ctx,
      buildQuestBoardDetailComponents(
        forgeChannelId
      ) as InteractionEditReplyOptions["components"]
    );
  } catch (e: unknown) {
    ctx.log.error("forge quest board select failed", e);
    if (isUnknownInteractionError(e)) return;
    const msg =
      e instanceof Error ? e.message : "Unexpected error building the board.";
    try {
      await editReplyPlain(interaction, `Error: ${msg}`, []);
    } catch (e2: unknown) {
      if (!isUnknownInteractionError(e2)) {
        ctx.log.warn("forge quest board select error reply failed", e2);
      }
    }
  }
}

export async function handleForgeQuestBoardButton(
  interaction: ButtonInteraction,
  ctx: ForgeInteractionContext,
  parsed: Extract<ParsedQuestBoardCustomId, { type: "back" | "page" }>
): Promise<void> {
  const forgeChannelId = parsed.forgeChannelId;
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this in a server.",
    });
    return;
  }

  const page = parsed.type === "page" ? parsed.page : 0;

  try {
    try {
      await interaction.deferUpdate();
    } catch (e: unknown) {
      if (isUnknownInteractionError(e)) {
        ctx.log.debug(
          "quest board button: interaction unknown before defer (expired or duplicate ack)"
        );
        return;
      }
      throw e;
    }
    const scope = await requireQuestBoardChannel(interaction, ctx, forgeChannelId);
    if (!scope) return;

    const list = await executeQuestBoardList(
      scope.guildId,
      forgeChannelId,
      questBoardDeps(ctx),
      page
    );
    if (list.kind === "no_buildings" || list.kind === "no_offers") {
      await editReplyQuestBoard(interaction, list.content, ctx, []);
      return;
    }
    await editReplyQuestBoard(
      interaction,
      list.content,
      ctx,
      buildQuestBoardListComponents(
        list,
        forgeChannelId
      ) as InteractionEditReplyOptions["components"]
    );
  } catch (e: unknown) {
    ctx.log.error("forge quest board button failed", e);
    if (isUnknownInteractionError(e)) return;
    const msg =
      e instanceof Error ? e.message : "Unexpected error building the board.";
    try {
      await editReplyPlain(interaction, `Error: ${msg}`, []);
    } catch (e2: unknown) {
      if (!isUnknownInteractionError(e2)) {
        ctx.log.warn("forge quest board button error reply failed", e2);
      }
    }
  }
}
