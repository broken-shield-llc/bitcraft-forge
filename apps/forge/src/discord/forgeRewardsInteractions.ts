import {
  type ButtonInteraction,
  type InteractionEditReplyOptions,
  MessageFlags,
  type StringSelectMenuInteraction,
} from "discord.js";
import {
  executeQuestRewardsList,
  executeQuestRewardsTotalsDetail,
  forgeChannelNotEnabledMessage,
  QUEST_REWARDS_ALL_STORES_VALUE,
} from "@forge/application";
import { isUnknownInteractionError, requireForgeChannelManage } from "@forge/discord-forge";
import type { ForgeInteractionContext } from "./forgeInteractions.js";
import {
  buildRewardsDetailComponents,
  buildRewardsListComponents,
  forgeRwShopCustomId,
  type ParsedForgeRewardsCustomId,
  stallRewardsEditPayload,
} from "./rewardsDiscord.js";
import {
  clearRewardsDetailState,
  getRewardsDetailState,
  getRewardsListPage,
  setRewardsDetailState,
  setRewardsListPage,
} from "./rewardsMessageState.js";

const MAX_DISCORD_SELECT_VALUE_LEN = 100;

function rewardsDeps(ctx: ForgeInteractionContext) {
  return {
    repo: ctx.repo,
    entityCacheRepo: ctx.entityCacheRepo,
    questOffers: ctx.questCache,
    discordCommandName: ctx.config.discordCommandName,
  } as const;
}

function manageDeniedContent(commandName: string): string {
  return [
    "You need **Manage Server** or **Manage Channels** to use Stall rewards controls.",
    "",
    `Someone with permission can open \`/${commandName} quest rewards\` here.`,
  ].join("\n");
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

async function editReplyRewards(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  fullContent: string,
  ctx: ForgeInteractionContext,
  components?: InteractionEditReplyOptions["components"]
): Promise<void> {
  await interaction.editReply(
    stallRewardsEditPayload(
      fullContent,
      ctx.config.questBoardBannerUrl,
      components
    )
  );
}

/** Run before `deferUpdate`: use `interaction.reply`. */
async function preflightRewardsAccess(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  ctx: ForgeInteractionContext,
  forgeChannelId: string
): Promise<{ guildId: string } | null> {
  const guildId = interaction.guildId;
  if (!guildId || !interaction.inGuild()) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this in a server.",
    });
    return null;
  }
  if (!requireForgeChannelManage(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: manageDeniedContent(ctx.config.discordCommandName),
    });
    return null;
  }
  if (interaction.channelId !== forgeChannelId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "These Stall rewards controls belong to another channel.",
    });
    return null;
  }
  const enabled = await ctx.repo.isForgeChannelEnabled(guildId, forgeChannelId);
  if (!enabled) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: forgeChannelNotEnabledMessage(ctx.config.discordCommandName),
    });
    return null;
  }
  return { guildId };
}

async function deferUpdateRewards(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  ctx: ForgeInteractionContext
): Promise<boolean> {
  try {
    await interaction.deferUpdate();
    return true;
  } catch (e: unknown) {
    if (isUnknownInteractionError(e)) {
      ctx.log.debug(
        "rewards interaction unknown before defer (expired or duplicate ack)"
      );
      return false;
    }
    throw e;
  }
}

export async function handleForgeRewardsSelect(
  interaction: StringSelectMenuInteraction,
  ctx: ForgeInteractionContext,
  forgeChannelId: string
): Promise<void> {
  if (interaction.customId !== forgeRwShopCustomId(forgeChannelId)) return;

  const access = await preflightRewardsAccess(interaction, ctx, forgeChannelId);
  if (!access) return;

  if (!(await deferUpdateRewards(interaction, ctx))) return;

  try {
    const scopeRaw = interaction.values[0];
    const validAll = scopeRaw === QUEST_REWARDS_ALL_STORES_VALUE;
    const validShop =
      Boolean(scopeRaw) &&
      typeof scopeRaw === "string" &&
      scopeRaw.length > 0 &&
      scopeRaw.length <= MAX_DISCORD_SELECT_VALUE_LEN;
    if (!validAll && !validShop) {
      await editReplyPlain(interaction, "Invalid selection.", []);
      return;
    }

    const listPg = getRewardsListPage(interaction.message.id);

    const d = await executeQuestRewardsTotalsDetail(
      access.guildId,
      forgeChannelId,
      rewardsDeps(ctx),
      scopeRaw!,
      0
    );
    if (d.kind === "not_found") {
      await interaction.editReply(
        stallRewardsEditPayload(d.content, ctx.config.questBoardBannerUrl, [])
      );
      return;
    }

    setRewardsDetailState(interaction.message.id, {
      listPage: listPg,
      scopeRaw: scopeRaw!,
      detailPageIdx: d.detailPage,
    });

    await editReplyRewards(
      interaction,
      d.content,
      ctx,
      buildRewardsDetailComponents(forgeChannelId, {
        detailPageIdx: d.detailPage,
        totalDetailPages: d.totalsDetailPages,
      }) as InteractionEditReplyOptions["components"]
    );
  } catch (e: unknown) {
    ctx.log.error("forge rewards select failed", e);
    if (!isUnknownInteractionError(e)) {
      const msg =
        e instanceof Error ? e.message : "Unexpected error rendering rewards.";
      try {
        await editReplyPlain(interaction, `Error: ${msg}`, []);
      } catch {
        void 0;
      }
    }
  }
}

export async function handleForgeRewardsButton(
  interaction: ButtonInteraction,
  ctx: ForgeInteractionContext,
  parsed: ParsedForgeRewardsCustomId
): Promise<void> {
  if (
    parsed.type !== "reward_list_page" &&
    parsed.type !== "reward_back" &&
    parsed.type !== "reward_detail_prev" &&
    parsed.type !== "reward_detail_next"
  )
    return;

  const forgeChannelId = parsed.forgeChannelId;
  const access = await preflightRewardsAccess(interaction, ctx, forgeChannelId);
  if (!access) return;

  if (!(await deferUpdateRewards(interaction, ctx))) return;

  try {
    if (
      parsed.type === "reward_detail_prev" ||
      parsed.type === "reward_detail_next"
    ) {
      const st = getRewardsDetailState(interaction.message.id);
      if (!st) {
        await editReplyRewards(
          interaction,
          `This Stall rewards view is out of date. Run \`/${ctx.config.discordCommandName} quest rewards\` again.`,
          ctx,
          []
        );
        return;
      }

      const delta = parsed.type === "reward_detail_next" ? 1 : -1;
      const target = Math.max(0, st.detailPageIdx + delta);

      const d = await executeQuestRewardsTotalsDetail(
        access.guildId,
        forgeChannelId,
        rewardsDeps(ctx),
        st.scopeRaw,
        target
      );
      if (d.kind === "not_found") {
        clearRewardsDetailState(interaction.message.id);
        await interaction.editReply(
          stallRewardsEditPayload(d.content, ctx.config.questBoardBannerUrl, [])
        );
        return;
      }

      setRewardsDetailState(interaction.message.id, {
        listPage: st.listPage,
        scopeRaw: st.scopeRaw,
        detailPageIdx: d.detailPage,
      });

      await editReplyRewards(
        interaction,
        d.content,
        ctx,
        buildRewardsDetailComponents(forgeChannelId, {
          detailPageIdx: d.detailPage,
          totalDetailPages: d.totalsDetailPages,
        }) as InteractionEditReplyOptions["components"]
      );
      return;
    }

    if (parsed.type === "reward_back") {
      const detailBeforeClear = getRewardsDetailState(interaction.message.id);
      const lp =
        detailBeforeClear?.listPage ?? getRewardsListPage(interaction.message.id);
      clearRewardsDetailState(interaction.message.id);

      const list = await executeQuestRewardsList(
        access.guildId,
        forgeChannelId,
        rewardsDeps(ctx),
        lp
      );
      if (list.kind === "no_buildings" || list.kind === "no_open_orders") {
        await interaction.editReply(
          stallRewardsEditPayload(
            list.content,
            ctx.config.questBoardBannerUrl,
            []
          )
        );
        return;
      }
      if (list.kind !== "list") {
        await editReplyPlain(interaction, "Unexpected Stall rewards state.", []);
        return;
      }
      setRewardsListPage(interaction.message.id, list.page);

      await editReplyRewards(
        interaction,
        list.content,
        ctx,
        buildRewardsListComponents(
          list,
          forgeChannelId
        ) as InteractionEditReplyOptions["components"]
      );
      return;
    }

    /** reward_list_page */
    clearRewardsDetailState(interaction.message.id);

    const list = await executeQuestRewardsList(
      access.guildId,
      forgeChannelId,
      rewardsDeps(ctx),
      parsed.page
    );
    if (list.kind === "no_buildings" || list.kind === "no_open_orders") {
      await interaction.editReply(
        stallRewardsEditPayload(list.content, ctx.config.questBoardBannerUrl, [])
      );
      return;
    }
    if (list.kind !== "list") {
      await editReplyPlain(interaction, "Unexpected Stall rewards state.", []);
      return;
    }

    setRewardsListPage(interaction.message.id, list.page);

    await editReplyRewards(
      interaction,
      list.content,
      ctx,
      buildRewardsListComponents(
        list,
        forgeChannelId
      ) as InteractionEditReplyOptions["components"]
    );
  } catch (e: unknown) {
    ctx.log.error("forge rewards button failed", e);
    if (!isUnknownInteractionError(e)) {
      const msg =
        e instanceof Error ? e.message : "Unexpected error updating rewards.";
      try {
        await editReplyPlain(interaction, `Error: ${msg}`, []);
      } catch {
        void 0;
      }
    }
  }
}
