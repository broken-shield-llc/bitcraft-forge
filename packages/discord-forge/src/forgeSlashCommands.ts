import { ChannelType, SlashCommandBuilder } from "discord.js";

export function buildForgeSlashCommand(commandName: string) {
  return new SlashCommandBuilder()
    .setName(commandName)
    .setDescription("BitCraft barter boards, quest leaderboard, and settlement alerts in Discord")
    // Explicit: no guild-level permission gate on the command tree (mods still gate via Integrations UI).
    .setDefaultMemberPermissions(null)
    .addSubcommand((s) =>
      s
        .setName("health")
        .setDescription(
          "Forge technical status for operators (Manage Server; server text channel)"
        )
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
            .setName("search")
            .setDescription(
              "Quest board filtered to offers that require an item whose name contains your query"
            )
            .addStringOption((o) =>
              o
                .setName("query")
                .setDescription(
                  "Match required turn-in item names (case-insensitive substring)"
                )
                .setRequired(true)
                .setMaxLength(100)
            )
        )
        .addSubcommand((s) =>
          s
            .setName("rewards")
            .setDescription(
              "Stall reward-stock totals picker (combined or per stall, mods)"
            )
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
        .addSubcommand((s) =>
          s
            .setName("scoring")
            .setDescription(
              "View or set quest leaderboard scoring (Manage Server)"
            )
            .addStringOption((o) =>
              o
                .setName("action")
                .setDescription("Show current config or apply new settings")
                .setRequired(true)
                .addChoices(
                  { name: "show", value: "show" },
                  { name: "set", value: "set" }
                )
            )
            .addStringOption((o) =>
              o
                .setName("mode")
                .setDescription("Scoring mode (required when action is set)")
                .setRequired(false)
                .addChoices(
                  { name: "default", value: "default" },
                  { name: "weighted max", value: "weighted_require_max" },
                  { name: "weighted sum", value: "weighted_require_sum" }
                )
            )
            .addIntegerOption((o) =>
              o
                .setName("untiered")
                .setDescription("Weight for untiered / tier 0 items (set only)")
                .setRequired(false)
                .setMinValue(0)
            )
            .addIntegerOption((o) =>
              o
                .setName("tier_1")
                .setDescription("Weight for tier 1 (set only)")
                .setRequired(false)
                .setMinValue(0)
            )
            .addIntegerOption((o) =>
              o
                .setName("tier_2")
                .setDescription("Weight for tier 2 (set only)")
                .setRequired(false)
                .setMinValue(0)
            )
            .addIntegerOption((o) =>
              o
                .setName("tier_3")
                .setDescription("Weight for tier 3 (set only)")
                .setRequired(false)
                .setMinValue(0)
            )
            .addIntegerOption((o) =>
              o
                .setName("tier_4")
                .setDescription("Weight for tier 4 (set only)")
                .setRequired(false)
                .setMinValue(0)
            )
            .addIntegerOption((o) =>
              o
                .setName("tier_5")
                .setDescription("Weight for tier 5 (set only)")
                .setRequired(false)
                .setMinValue(0)
            )
            .addIntegerOption((o) =>
              o
                .setName("tier_6")
                .setDescription("Weight for tier 6 (set only)")
                .setRequired(false)
                .setMinValue(0)
            )
            .addIntegerOption((o) =>
              o
                .setName("tier_7")
                .setDescription("Weight for tier 7 (set only)")
                .setRequired(false)
                .setMinValue(0)
            )
            .addIntegerOption((o) =>
              o
                .setName("tier_8")
                .setDescription("Weight for tier 8 (set only)")
                .setRequired(false)
                .setMinValue(0)
            )
            .addIntegerOption((o) =>
              o
                .setName("tier_9")
                .setDescription("Weight for tier 9 (set only)")
                .setRequired(false)
                .setMinValue(0)
            )
            .addIntegerOption((o) =>
              o
                .setName("tier_10")
                .setDescription("Weight for tier 10+ (set only)")
                .setRequired(false)
                .setMinValue(0)
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
            .addStringOption((o) =>
              o
                .setName("target")
                .setDescription(
                  "Which stream to configure (omit = default fallback)"
                )
                .setRequired(false)
                .addChoices(
                  { name: "default", value: "default" },
                  { name: "quest-added", value: "quest_added" },
                  { name: "quest-updated", value: "quest_updated" },
                  { name: "quest-completion", value: "quest_completion" }
                )
            )
            .addChannelOption((o) =>
              o
                .setName("channel")
                .setDescription(
                  "Any server text channel, announcement channel, or thread (omit = clear)"
                )
                .addChannelTypes(
                  ChannelType.GuildText,
                  ChannelType.GuildAnnouncement,
                  ChannelType.PublicThread,
                  ChannelType.PrivateThread,
                  ChannelType.AnnouncementThread
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
