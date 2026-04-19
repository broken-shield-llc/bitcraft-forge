# BitCraft FORGE

**FORGE** (Flow Orchestration & Relay for Game Events) is a self-hosted service for [BitCraft Online](https://bitcraft.trinit.is/docs/intro) communities: a **Discord bot** plus a **read-only** [SpacetimeDB](https://spacetimedb.com/) client. It subscribes to BitCraft’s live module over WebSocket, projects barter listings into in-memory “quest” views, mirrors selected tables into **PostgreSQL** for labels and health metrics, and posts debounced announcements to channels you configure.

The bot does **not** invoke SpacetimeDB reducers; it only subscribes to tables and listens for committed game events.

**Disclaimer:** FORGE is independent, community-maintained software. It is **not** affiliated with, endorsed by, or supported by Clockwork Labs, BitCraft, Discord, or SpacetimeDB.

Licensed under the [MIT License](LICENSE). See [SECURITY.md](SECURITY.md) for how to report security issues responsibly.

## Features

- **Per-channel scope** — Each Discord text channel can be enabled independently (`/forge enable`), with its own monitors, announcement routing, and leaderboard data.
- **Monitors** — Track BitCraft **claims** and **barter buildings** (stall vs counter is inferred from game data).
- **Quest board** — Lists active barter offers for buildings monitored in that channel’s scope.
- **Leaderboard** — Ranks members by **quest points** summed from barter completions at monitored buildings. Each completion stores a snapshot of **offer** and **require** item stacks (for analytics); scoring uses **require** stacks and each item’s **crafting tier** from cached `item_desc` (`tier` field).
- **Quest scoring** — Per scope: **default** (always **1** point per completion), **weighted max**, or **weighted sum** (see slash command descriptions). When you turn on a weighted mode from **default**, tier weights start at **1** for untiered and tier 1 and **N** for tier N (2–10) until you override them. Channel leads use `/forge quest scoring` (**Manage Server** or **Manage Channels**).
- **Announcements** — Optional text or announcement channels for debounced embeds when offers change or complete. `/forge channel set` can route a **default** stream or separate channels for **quest added**, **quest updated**, and **quest completion** traffic.

## SpacetimeDB usage

Connection is configured with `FORGE_BITCRAFT_WS_URI`, `FORGE_BITCRAFT_MODULE`, and a BitCraft session JWT (`FORGE_BITCRAFT_JWT`) (see the [BitCraft community intro](https://bitcraft.trinit.is/docs/intro)). Generated client code comes from the community [BitCraft_Bindings](https://github.com/BitCraftToolBox/BitCraft_Bindings) (`ts-region` branch), vendored under `apps/forge/vendor/` during install.

### Table subscriptions (read-only)

These SQL subscriptions keep quest projection and entity metadata in sync:


| Purpose                           | Subscription                              |
| --------------------------------- | ----------------------------------------- |
| Barter quest projection           | `SELECT * FROM traveler_trade_order_desc` |
|                                   | `SELECT * FROM trade_order_state`         |
| Entity cache (labels, board copy) | `SELECT * FROM item_desc`                 |
|                                   | `SELECT * FROM claim_state`               |
|                                   | `SELECT * FROM building_state`            |
|                                   | `SELECT * FROM building_desc`             |
|                                   | `SELECT * FROM building_nickname_state`   |
|                                   | `SELECT * FROM inventory_state`           |
|                                   | `SELECT * FROM user_state`                |
|                                   | `SELECT * FROM player_username_state`     |


### Game events

Committed `barter_stall_order_accept` callbacks are used to log quest completions when the shop entity matches a **monitored building** for that Discord scope.

### PostgreSQL cache

Rows from the entity tables above are upserted into local cache tables (see `packages/db` / migrations) with a TTL controlled by `FORGE_STDB_CACHE_TTL_MS`, so Discord can show item names, building nicknames, and similar without hammering SpacetimeDB.

### Quest completions and scoring (Postgres)

When a monitored barter completes, Forge inserts a `quest_completions` row with `offer_stacks`, `require_stacks` (JSON), and `leaderboard_points` derived from the scope’s scoring mode and tier weights. Changing mode or weights via `/forge quest scoring set` **recomputes** `leaderboard_points` for all completions in that scope from the stored require stacks and current item cache tiers.

## Discord commands

Commands are registered when the bot starts: **guild** commands if `FORGE_DISCORD_GUILD_ID` is set, otherwise **global** commands (Discord can take up to about an hour to propagate global commands).

**If `/forge` does not appear in a server:** the bot is probably using **guild-only** registration for a *different* guild id (see startup log `guild_id=…`). For a shared or friend’s server, **leave `FORGE_DISCORD_GUILD_ID` unset** so commands register **globally**, restart the bot, and wait for Discord to sync. Also confirm **Server Settings → Integrations → your app** has not restricted command use to roles you lack, and that the bot is a **public** application if others invite it.

**If only admins (e.g. Manage Server) see `/forge`:** that pattern is almost always **Discord integration command permissions**, not Forge env. Someone with **Manage Server** should open **Server Settings → Integrations → (this bot)** and check **Manage** / command permissions: remove role restrictions that hide the app’s commands, or explicitly allow **@everyone** (or your role). Also check the **channel** (or category): **Permissions → Use Application Commands** must be allowed for you in the channel where you type `/forge`. After changing integration permissions, you may need to restart the Discord client or wait a short time for the command list to refresh.

**Root command name** — This document uses **`/forge`** as the root. When `FORGE_DISCORD_COMMAND_NAME` is set (see `.env.example`), substitute that name for `forge` in every command path.

Unless noted, use commands in a **server text channel**.

**Permissions:** **Manage Server** is required for `health` (operator diagnostics), `enable`, and `disable`. For everything else that configures this channel’s Forge scope (claims, buildings, where messages post, quest scoring, and resetting the quest leaderboard), members need **Manage Server** *or* **Manage Channels** so channel moderators can run settlement tools without full server admin. The quest board and leaderboard are **Anyone** where marked below (no mod permission).


| Command                    | Description                                                                  | Permission                       |
| -------------------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| `/forge health`            | Operator diagnostics: SpacetimeDB and quest projection status, Postgres entity-cache row counts, slash registration (global vs single-guild) | Manage Server                    |
| `/forge enable`            | Turn on Forge for this channel's scope                                       | Manage Server                    |
| `/forge disable`           | Turn off Forge for this channel's scope and clear its data                    | Manage Server                    |
| `/forge quest board`†       | Active barter offers for this channel's scope                                 | Anyone                           |
| `/forge quest leaderboard`† | Quest leaderboard for this channel's scope (totals **points**)                | Anyone                           |
| `/forge quest scoring`†     | Show or set scoring mode and optional tier weights (`action` + `mode` when setting) | Manage Server or Manage Channels |
| `/forge quest reset-leaderboard`† | Clear quest completions for this channel's scope                         | Manage Server or Manage Channels |
| `/forge channel set`†       | Set or clear where barter and quest messages post for this channel's scope    | Manage Server or Manage Channels |
| `/forge claim add`†         | Watch a claim for this channel's scope (`claim_id`)                          | Manage Server or Manage Channels |
| `/forge claim remove`†      | Stop watching a claim for this channel's scope                               | Manage Server or Manage Channels |
| `/forge claim list`†        | Claims watched for this channel's scope                                      | Manage Server or Manage Channels |
| `/forge building add`†      | Watch a barter building for this channel's scope (`building_id`)             | Manage Server or Manage Channels |
| `/forge building remove`†   | Stop watching a building for this channel's scope                              | Manage Server or Manage Channels |
| `/forge building list`†     | Barter buildings watched for this channel's scope                            | Manage Server or Manage Channels |

**† Requires Forge enabled for this channel** — Run `/forge enable` in this channel first (that command needs **Manage Server**). Applies to every command row marked with † above.

The quest board may include buttons or selects; the bot uses the `Guilds` intent only.

## Requirements

- **Node.js** 20+
- **pnpm** 9+ (this repo pins a version in `package.json`; with [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`)
- **PostgreSQL** (schema and migrations under `packages/db`)
- A **Discord application** with a bot user: bot token and application ID
- A valid **BitCraft JWT** for SpacetimeDB if you want live game data (if unset, the bot can still run but will not maintain a game connection)

## Local development

1. **Install dependencies** (from the repository root):

   ```bash
   pnpm install
   ```

   The `prepare` script clones BitCraft_Bindings into `apps/forge/vendor/` unless you set `FORGE_SKIP_BINDINGS_CLONE=1` (useful for CI or restricted networks).

2. **Configure environment** — Copy [`.env.example`](.env.example) to `.env` at the repo root or under `apps/forge/`. The process loads the first existing file in that order. Set at least:

   - `FORGE_DISCORD_TOKEN` — **Bot** token (Developer Portal → **Bot**). Do not use the OAuth2 client secret.
   - `FORGE_DISCORD_APPLICATION_ID` — Same application’s **Application ID** (same value as the OAuth2 “Client ID”).
   - `FORGE_DATABASE_URL` — PostgreSQL connection string, **or** the composite variables `FORGE_DATABASE_HOST`, `FORGE_DATABASE_USER`, `FORGE_DATABASE_PASSWORD`, and `FORGE_DATABASE_NAME` (optional `FORGE_DATABASE_PORT`, `FORGE_DATABASE_SSLMODE`) when no single URL is used (for example in containers).
   - `FORGE_BITCRAFT_WS_URI`, `FORGE_BITCRAFT_MODULE`, `FORGE_BITCRAFT_JWT` — BitCraft SpacetimeDB endpoint and session token.

   Optional variables (debounce timings, quest board/leaderboard/completion banner URLs, `FORGE_HEALTH_PORT` for `GET /health`, guild-scoped slash registration, root command name, etc.) are documented in `.env.example`.

3. **Start PostgreSQL** — For example, from the repo root: `docker compose up -d` using [docker-compose.yml](docker-compose.yml), then point `FORGE_DATABASE_URL` (or the composite `FORGE_DATABASE_*` variables) at that instance.

4. **Run the app** — Migrations apply on startup when the forge process starts.

   ```bash
   pnpm dev
   ```

   Other useful commands:

   ```bash
   pnpm test         # Vitest across workspace packages
   pnpm typecheck    # TypeScript
   pnpm start        # production-style start (forge app)
   pnpm db:generate  # emit SQL after schema changes (needs FORGE_DATABASE_URL)
   pnpm db:migrate   # run Drizzle migrations via the forge migrate-db script
   ```

5. **Develop with one guild** — Set `FORGE_DISCORD_GUILD_ID` so slash commands register immediately for that server instead of globally.

## Project layout

Monorepo: runnable app in `apps/forge`; shared libraries in `packages/` (`@forge/config`, `@forge/domain`, `@forge/db`, `@forge/repos`, `@forge/application`, `@forge/discord-forge`, `@forge/logger`). The SpacetimeDB client uses `@clockworklabs/spacetimedb-sdk` **1.3.x** with a small [pnpm patch](patches/@clockworklabs__spacetimedb-sdk@1.3.3.patch) aligned to the vendored bindings.

## Credits

Thanks to the people who helped shape FORGE and the path to it:

- **Tony** (the face of R9) — for the ideas that led to this service and for all the help testing.
- **trin1trotoluene** — for helping me get on my feet when I started tinkering with SpacetimeDB.
- **wiz** — for keeping us supplied with current BitCraft bindings.
- **xCausxn** — for the inspiration to dive into this nonsense.
