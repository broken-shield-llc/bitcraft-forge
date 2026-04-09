import {
  type ButtonInteraction,
  type InteractionEditReplyOptions,
  MessageFlags,
  type StringSelectMenuInteraction,
} from "discord.js";
import {
  executeQuestBoardList,
  executeQuestBoardShopDetail,
} from "@forge/application";
import { isUnknownInteractionError } from "@forge/discord-forge";
import type { ForgeInteractionContext } from "./forgeInteractions.js";
import {
  buildQuestBoardDetailComponents,
  buildQuestBoardListComponents,
  FORGE_QB_BACK_CUSTOM_ID,
  FORGE_QB_PAGE_PREFIX,
  FORGE_QB_SELECT_CUSTOM_ID,
  parseForgeQbPageCustomId,
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

export async function handleForgeQuestBoardSelect(
  interaction: StringSelectMenuInteraction,
  ctx: ForgeInteractionContext
): Promise<void> {
  if (interaction.customId !== FORGE_QB_SELECT_CUSTOM_ID) return;

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
    const guildId = interaction.guildId;
    if (!guildId) {
      await editReplyPlain(interaction, "Use this in a server.", []);
      return;
    }

    const shopId = interaction.values[0];
    if (!shopId || shopId.length > 100) {
      await editReplyPlain(interaction, "Invalid shop selection.", []);
      return;
    }

    const d = await executeQuestBoardShopDetail(
      guildId,
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
      buildQuestBoardDetailComponents() as InteractionEditReplyOptions["components"]
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
  ctx: ForgeInteractionContext
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this in a server.",
    });
    return;
  }

  const { customId } = interaction;

  if (customId === FORGE_QB_BACK_CUSTOM_ID) {
    try {
      try {
        await interaction.deferUpdate();
      } catch (e: unknown) {
        if (isUnknownInteractionError(e)) {
          ctx.log.debug(
            "quest board back: interaction unknown before defer (expired or duplicate ack)"
          );
          return;
        }
        throw e;
      }
      const list = await executeQuestBoardList(
        guildId,
        questBoardDeps(ctx),
        0
      );
      if (list.kind === "no_buildings" || list.kind === "no_offers") {
        await editReplyQuestBoard(interaction, list.content, ctx, []);
        return;
      }
      await editReplyQuestBoard(
        interaction,
        list.content,
        ctx,
        buildQuestBoardListComponents(list) as InteractionEditReplyOptions["components"]
      );
    } catch (e: unknown) {
      ctx.log.error("forge quest board back failed", e);
      if (isUnknownInteractionError(e)) return;
      const msg =
        e instanceof Error ? e.message : "Unexpected error building the board.";
      try {
        await editReplyPlain(interaction, `Error: ${msg}`, []);
      } catch (e2: unknown) {
        if (!isUnknownInteractionError(e2)) {
          ctx.log.warn("forge quest board back error reply failed", e2);
        }
      }
    }
    return;
  }

  if (customId.startsWith(FORGE_QB_PAGE_PREFIX)) {
    const page = parseForgeQbPageCustomId(customId);
    if (page === null) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "Invalid board control.",
      });
      return;
    }
    try {
      try {
        await interaction.deferUpdate();
      } catch (e: unknown) {
        if (isUnknownInteractionError(e)) {
          ctx.log.debug(
            "quest board page: interaction unknown before defer (expired or duplicate ack)"
          );
          return;
        }
        throw e;
      }
      const list = await executeQuestBoardList(
        guildId,
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
        buildQuestBoardListComponents(list) as InteractionEditReplyOptions["components"]
      );
    } catch (e: unknown) {
      ctx.log.error("forge quest board page failed", e);
      if (isUnknownInteractionError(e)) return;
      const msg =
        e instanceof Error ? e.message : "Unexpected error building the board.";
      try {
        await editReplyPlain(interaction, `Error: ${msg}`, []);
      } catch (e2: unknown) {
        if (!isUnknownInteractionError(e2)) {
          ctx.log.warn("forge quest board page error reply failed", e2);
        }
      }
    }
  }
}
