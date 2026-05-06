import {
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
} from "discord.js";

type GuildForgePermissionInteraction =
  | ChatInputCommandInteraction
  | MessageComponentInteraction;

export function requireManageGuild(
  interaction: ChatInputCommandInteraction
): boolean {
  if (!interaction.inGuild()) return false;
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

/**
 * For per-channel Forge scope: **Manage Server** *or* **Manage Channels** on the channel
 * where the command is run. Lets settlement leads who moderate a channel (without full
 * server admin) configure watches, announcements target, quest scoring, and leaderboard reset.
 */
export function requireForgeChannelManage(
  interaction: GuildForgePermissionInteraction
): boolean {
  if (!interaction.inGuild()) return false;
  const p = interaction.memberPermissions;
  if (!p) return false;
  return (
    p.has(PermissionFlagsBits.ManageGuild) ||
    p.has(PermissionFlagsBits.ManageChannels)
  );
}

/** Discord REST 10062 — token expired or already used; further replies will fail. */
export function isUnknownInteractionError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: unknown }).code === 10062
  );
}
