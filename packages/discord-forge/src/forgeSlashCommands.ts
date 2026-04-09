import { ChannelType, SlashCommandBuilder } from "discord.js";

export function buildForgeSlashCommand() {
  return new SlashCommandBuilder()
    .setName("forge")
    .setDescription("FORGE — Flow Orchestration & Relay for Game Events")
    .addSubcommand((s) =>
      s
        .setName("health")
        .setDescription("Build info and SpacetimeDB connection status")
    )
    .addSubcommand((s) =>
      s
        .setName("enable")
        .setDescription(
          "Enable BitCraft Forge for this channel (separate config per channel)"
        )
    )
    .addSubcommand((s) =>
      s
        .setName("disable")
        .setDescription(
          "Disable BitCraft Forge for this channel and remove its monitors / leaderboard data"
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName("quest")
        .setDescription("Barter quest board and leaderboard")
        .addSubcommand((s) =>
          s
            .setName("board")
            .setDescription(
              "Show active barter offers for monitored buildings (from SpacetimeDB cache)"
            )
        )
        .addSubcommand((s) =>
          s
            .setName("leaderboard")
            .setDescription(
              "Top members by logged quest completions in this channel"
            )
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName("channel")
        .setDescription(
          "Where FORGE posts barter announcements for this channel’s scope"
        )
        .addSubcommand((s) =>
          s
            .setName("set")
            .setDescription("Set the channel for debounced barter / quest embeds")
            .addChannelOption((o) =>
              o
                .setName("announcements")
                .setDescription("Text channel (omit to clear)")
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
        .setDescription("Monitor BitCraft claims in this channel’s Forge scope")
        .addSubcommand((s) =>
          s
            .setName("add")
            .setDescription("Start monitoring a claim")
            .addStringOption((o) =>
              o
                .setName("claim_id")
                .setDescription("BitCraft claim id")
                .setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s
            .setName("remove")
            .setDescription("Stop monitoring a claim")
            .addStringOption((o) =>
              o
                .setName("claim_id")
                .setDescription("BitCraft claim id")
                .setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s
            .setName("list")
            .setDescription("List monitored claims for this channel’s Forge scope")
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName("building")
        .setDescription(
          "Monitor Barter Stalls or Barter Counters in this channel’s Forge scope"
        )
        .addSubcommand((s) =>
          s
            .setName("add")
            .setDescription(
              "Start monitoring a barter building (stall vs counter is detected from game data)"
            )
            .addStringOption((o) =>
              o
                .setName("building_id")
                .setDescription("BitCraft building id")
                .setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s
            .setName("remove")
            .setDescription("Stop monitoring a building")
            .addStringOption((o) =>
              o
                .setName("building_id")
                .setDescription("BitCraft building id")
                .setRequired(true)
            )
        )
        .addSubcommand((s) =>
          s
            .setName("list")
            .setDescription(
              "List monitored buildings for this channel’s Forge scope"
            )
        )
    );
}
