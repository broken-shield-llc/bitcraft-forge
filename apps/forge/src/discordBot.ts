import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import { buildForgeSlashCommand } from "@forge/discord-forge";
import type { QuestOfferCache } from "./bitcraft/index.js";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";
import {
  handleForgeQuestBoardButton,
  handleForgeQuestBoardSelect,
} from "./discord/forgeQuestBoardInteractions.js";
import { handleForgeInteraction } from "./discord/forgeInteractions.js";
import {
  isForgeQuestBoardComponent,
  parseForgeQuestBoardCustomId,
} from "./discord/questBoardDiscord.js";

function isDiscordUnauthorized(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    (e as { status: unknown }).status === 401
  );
}

function explainDiscordAuthFailure(config: ForgeConfig, phase: string): void {
  console.error(`[forge] Discord API 401 Unauthorized while ${phase}.

Your bot token is invalid, revoked, or not for this application.

Verify in the Discord Developer Portal (same application for all of these):
  • FORGE_DISCORD_TOKEN — Bot → token (click "Reset Token" if unsure; never use the OAuth2 "Client Secret" here)
  • FORGE_DISCORD_APPLICATION_ID — General Information → Application ID (same value as OAuth2 "Client ID")

Also check .env: no stray quotes, spaces, or line breaks inside the token line.

Using application id: ${config.discordApplicationId}
`);
}

export type DiscordBotDeps = {
  repo: GuildConfigRepository;
  entityCacheRepo: EntityCacheRepository;
  questCache: QuestOfferCache;
};

export async function startDiscordBot(
  config: ForgeConfig,
  log: Logger,
  deps: DiscordBotDeps
): Promise<Client> {
  const forgeCmd = buildForgeSlashCommand(config.discordCommandName);

  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const body = [forgeCmd.toJSON()];

  try {
    if (config.discordGuildId) {
      await rest.put(
        Routes.applicationGuildCommands(
          config.discordApplicationId,
          config.discordGuildId
        ),
        { body }
      );
      log.info(
        "Registered guild slash commands",
        `guild_id=${config.discordGuildId}`,
        "— /forge exists only in this server. Other servers will not see the command until you unset FORGE_DISCORD_GUILD_ID (global registration) or deploy with this id matching each target server."
      );
    } else {
      await rest.put(Routes.applicationCommands(config.discordApplicationId), {
        body,
      });
      log.info(
        "Registered global slash commands (Discord may take up to ~1h to show them)"
      );
    }
  } catch (e: unknown) {
    if (isDiscordUnauthorized(e)) {
      explainDiscordAuthFailure(config, "registering slash commands");
      process.exit(1);
    }
    throw e;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, (c) => {
    log.info(`Discord ready as ${c.user.tag}`);
  });

  const ictx = {
    config,
    log,
    repo: deps.repo,
    entityCacheRepo: deps.entityCacheRepo,
    questCache: deps.questCache,
  };

  client.on(Events.InteractionCreate, async (interaction) => {
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === config.discordCommandName
    ) {
      await handleForgeInteraction(interaction, ictx);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const p = parseForgeQuestBoardCustomId(interaction.customId);
      if (p?.type === "shop") {
        await handleForgeQuestBoardSelect(interaction, ictx, p.forgeChannelId);
      }
      return;
    }
    if (interaction.isButton()) {
      if (isForgeQuestBoardComponent(interaction.customId)) {
        const p = parseForgeQuestBoardCustomId(interaction.customId);
        if (
          p?.type === "back" ||
          p?.type === "page" ||
          p?.type === "detail_prev" ||
          p?.type === "detail_next"
        ) {
          await handleForgeQuestBoardButton(interaction, ictx, p);
        }
      }
      return;
    }
  });

  try {
    await client.login(config.discordToken);
  } catch (e: unknown) {
    if (isDiscordUnauthorized(e)) {
      explainDiscordAuthFailure(config, "logging in the bot");
      process.exit(1);
    }
    throw e;
  }
  return client;
}
