import {
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";

export function requireManageGuild(
  interaction: ChatInputCommandInteraction
): boolean {
  if (!interaction.inGuild()) return false;
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
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
