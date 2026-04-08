import { SlashCommandBuilder } from "discord.js";

export function buildForgeSlashCommand() {
  return new SlashCommandBuilder()
    .setName("forge")
    .setDescription("FORGE — Flow Orchestration & Relay for Game Events")
    .addSubcommand((s) =>
      s
        .setName("health")
        .setDescription("Build info and SpacetimeDB connection status")
    )
    .addSubcommandGroup((g) =>
      g
        .setName("claim")
        .setDescription("Monitor BitCraft claims in this Discord server")
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
          s.setName("list").setDescription("List monitored claims for this server")
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName("building")
        .setDescription("Monitor Barter Stalls or Barter Counters in this Discord server")
        .addSubcommand((s) =>
          s
            .setName("add")
            .setDescription("Start monitoring a Barter Stall or Barter Counter")
            .addStringOption((o) =>
              o
                .setName("building_id")
                .setDescription("BitCraft building id")
                .setRequired(true)
            )
            .addStringOption((o) =>
              o
                .setName("kind")
                .setDescription("Barter Stall or Barter Counter")
                .setRequired(true)
                .addChoices(
                  { name: "Barter Stall", value: "stall" },
                  { name: "Barter Counter", value: "counter" }
                )
            )
            .addStringOption((o) =>
              o
                .setName("claim_id")
                .setDescription("Optional claim id for your records")
                .setRequired(false)
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
            .setDescription("List monitored buildings for this server")
        )
    );
}
