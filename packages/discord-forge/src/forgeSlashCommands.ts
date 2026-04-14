import { ChannelType, SlashCommandBuilder } from "discord.js";

export function buildForgeSlashCommand(commandName: string) {
  return new SlashCommandBuilder()
    .setName(commandName)
    .setDescription("BitCraft barter boards, quest leaderboard, and settlement alerts in Discord")
    .addSubcommand((s) =>
      s
        .setName("health")
        .setDescription("Forge version and connection status (works in DMs)")
    )
    .addSubcommand((s) =>
      s
        .setName("enable")
        .setDescription("Turn on Forge for this channel's scope")
    )
    .addSubcommand((s) =>
      s
        .setName("disable")
        .setDescription("Turn off Forge for this channel's scope and clear its data")
    )
    .addSubcommandGroup((g) =>
      g
        .setName("quest")
        .setDescription("Quest board and leaderboard for this channel's scope")
        .addSubcommand((s) =>
          s
            .setName("board")
            .setDescription("Active barter offers for this channel's scope")
        )
        .addSubcommand((s) =>
          s
            .setName("leaderboard")
            .setDescription("Quest leaderboard for this channel's scope")
        )
        .addSubcommand((s) =>
          s
            .setName("reset-leaderboard")
            .setDescription(
              "Clear the quest leaderboard for this channel's scope"
            )
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName("channel")
        .setDescription("Barter and quest message channel for this channel's scope")
        .addSubcommand((s) =>
          s
            .setName("set")
            .setDescription(
              "Set or clear where barter and quest messages post for this channel's scope"
            )
            .addChannelOption((o) =>
              o
                .setName("announcements")
                .setDescription("Text or announcement channel (omit to clear)")
                .addChannelTypes(
                  ChannelType.GuildText,
                  ChannelType.GuildAnnouncement
                )
                .setRequired(false)
            )
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName("claim")
        .setDescription("Settlement claims watched for this channel's scope")
        .addSubcommand((s) =>
          s
            .setName("add")
            .setDescription("Watch a claim for this channel's scope")
            .addStringOption((o) =>
              o
                .setName("claim_id")
                .setDescription("Claim ID from the game")
                .setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s
            .setName("remove")
            .setDescription("Stop watching a claim for this channel's scope")
            .addStringOption((o) =>
              o
                .setName("claim_id")
                .setDescription("Claim ID from the game")
                .setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s
            .setName("list")
            .setDescription("Claims watched for this channel's scope")
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName("building")
        .setDescription("Barter buildings watched for this channel's scope")
        .addSubcommand((s) =>
          s
            .setName("add")
            .setDescription("Watch a barter building for this channel's scope")
            .addStringOption((o) =>
              o
                .setName("building_id")
                .setDescription("Building ID from the game")
                .setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s
            .setName("remove")
            .setDescription("Stop watching a building for this channel's scope")
            .addStringOption((o) =>
              o
                .setName("building_id")
                .setDescription("Building ID from the game")
                .setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s
            .setName("list")
            .setDescription("Barter buildings watched for this channel's scope")
        )
    );
}
