import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import {
  formatBuildingKind,
  normalizeScopedId,
  parseBuildingKind,
} from "@forge/domain";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import { getStdbHealth } from "../stdbClient.js";
import type { GuildConfigRepository } from "@forge/repos";

export type ForgeInteractionContext = {
  config: ForgeConfig;
  log: Logger;
  repo: GuildConfigRepository;
};

function requireManageGuild(interaction: ChatInputCommandInteraction): boolean {
  if (!interaction.inGuild()) return false;
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

export async function handleForgeInteraction(
  interaction: ChatInputCommandInteraction,
  ctx: ForgeInteractionContext
): Promise<void> {
  if (interaction.commandName !== "forge") return;

  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(true);

  if (!group && sub === "health") {
    const h = getStdbHealth();
    const lines = [
      "**FORGE**",
      `Module: \`${ctx.config.bitcraftModule}\``,
      `Node \`${process.version}\``,
      `SpacetimeDB connected: **${h.connected}**`,
      `SpacetimeDB identity: \`${h.identityHex ?? "—"}\``,
      `Subscription applied: **${h.subscriptionApplied}**`,
      `\`region_connection_info\` rows (client cache): **${h.regionConnectionInfoCount}**`,
    ];
    if (h.lastError) lines.push(`Last STDB error: \`${h.lastError}\``);

    await interaction.reply({
      ephemeral: true,
      content: lines.join("\n"),
    });
    return;
  }

  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({
      ephemeral: true,
      content: "Use `/forge` claim and building commands in a server, not in DMs.",
    });
    return;
  }

  if (!requireManageGuild(interaction)) {
    await interaction.reply({
      ephemeral: true,
      content:
        "You need the **Manage Server** permission to configure FORGE monitors for this server.",
    });
    return;
  }

  const guildId = interaction.guildId;

  try {
    if (group === "claim") {
      if (sub === "list") {
        const claims = await ctx.repo.listClaims(guildId);
        await interaction.reply({
          ephemeral: true,
          content:
            claims.length === 0
              ? "No claims are being monitored yet. Use `/forge claim add`."
              : `**Monitored claims (${claims.length})**\n${claims.map((c) => `• \`${c}\``).join("\n")}`,
        });
        return;
      }

      const rawClaim = interaction.options.getString("claim_id", true);
      const claimId = normalizeScopedId(rawClaim);
      if (!claimId) {
        await interaction.reply({
          ephemeral: true,
          content: "Invalid `claim_id` (empty or too long, max 128 characters).",
        });
        return;
      }

      if (sub === "add") {
        const r = await ctx.repo.addClaim(guildId, claimId);
        await interaction.reply({
          ephemeral: true,
          content:
            r === "duplicate"
              ? `Claim \`${claimId}\` is already monitored.`
              : `Now monitoring claim \`${claimId}\`.`,
        });
        return;
      }

      if (sub === "remove") {
        const removed = await ctx.repo.removeClaim(guildId, claimId);
        await interaction.reply({
          ephemeral: true,
          content: removed
            ? `Stopped monitoring claim \`${claimId}\`.`
            : `Claim \`${claimId}\` was not in the monitor list.`,
        });
        return;
      }

      await interaction.reply({
        ephemeral: true,
        content: "Unknown `/forge claim` subcommand.",
      });
      return;
    }

    if (group === "building") {
      if (sub === "list") {
        const buildings = await ctx.repo.listBuildings(guildId);
        await interaction.reply({
          ephemeral: true,
          content:
            buildings.length === 0
              ? "No buildings are being monitored yet. Use `/forge building add`."
              : `**Monitored buildings (${buildings.length})**\n${buildings
                  .map(
                    (b) =>
                      `• \`${b.buildingId}\` (${formatBuildingKind(b.kind)})${b.claimId ? ` — claim \`${b.claimId}\`` : ""}`
                  )
                  .join("\n")}`,
        });
        return;
      }

      if (sub === "add") {
        const rawBuilding = interaction.options.getString("building_id", true);
        const buildingId = normalizeScopedId(rawBuilding);
        if (!buildingId) {
          await interaction.reply({
            ephemeral: true,
            content:
              "Invalid `building_id` (empty or too long, max 128 characters).",
          });
          return;
        }

        const kindRaw = interaction.options.getString("kind", true);
        const kind = parseBuildingKind(kindRaw);
        if (!kind) {
          await interaction.reply({
            ephemeral: true,
            content:
              "Invalid building `kind` (choose **Barter Stall** or **Barter Counter**).",
          });
          return;
        }

        const rawOptClaim = interaction.options.getString("claim_id");
        const optClaim =
          rawOptClaim === null ? undefined : normalizeScopedId(rawOptClaim);
        if (rawOptClaim !== null && rawOptClaim.trim() !== "" && !optClaim) {
          await interaction.reply({
            ephemeral: true,
            content:
              "Invalid optional `claim_id` (too long, max 128 characters).",
          });
          return;
        }

        const claimRef = optClaim ?? undefined;
        const r = await ctx.repo.addBuilding(
          guildId,
          buildingId,
          kind,
          claimRef
        );
        await interaction.reply({
          ephemeral: true,
          content:
            r === "duplicate"
              ? `Building \`${buildingId}\` is already monitored.`
              : `Now monitoring building \`${buildingId}\` as **${formatBuildingKind(kind)}**${claimRef ? ` (claim \`${claimRef}\`)` : ""}.`,
        });
        return;
      }

      if (sub === "remove") {
        const rawBuilding = interaction.options.getString("building_id", true);
        const buildingId = normalizeScopedId(rawBuilding);
        if (!buildingId) {
          await interaction.reply({
            ephemeral: true,
            content:
              "Invalid `building_id` (empty or too long, max 128 characters).",
          });
          return;
        }

        const removed = await ctx.repo.removeBuilding(guildId, buildingId);
        await interaction.reply({
          ephemeral: true,
          content: removed
            ? `Stopped monitoring building \`${buildingId}\`.`
            : `Building \`${buildingId}\` was not in the monitor list.`,
        });
        return;
      }

      await interaction.reply({
        ephemeral: true,
        content: "Unknown `/forge building` subcommand.",
      });
      return;
    }

    await interaction.reply({
      ephemeral: true,
      content: "Unknown FORGE command.",
    });
  } catch (e: unknown) {
    ctx.log.error("forge command failed", e);
    const msg =
      e instanceof Error ? e.message : "Unexpected error while using the database.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ ephemeral: true, content: `Error: ${msg}` });
    } else {
      await interaction.reply({ ephemeral: true, content: `Error: ${msg}` });
    }
  }
}
