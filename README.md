# BitCraft FORGE

**FORGE** (Flow Orchestration & Relay for Game Events) is a self-hosted service for [BitCraft Online](https://bitcraft.trinit.is/docs/intro) communities: a **Discord bot** plus a **read-only** [SpacetimeDB](https://spacetimedb.com/) client. It subscribes to BitCraft’s live module over WebSocket, projects barter listings into in-memory “quest” views, mirrors selected tables into **PostgreSQL** for labels and health metrics, and posts debounced announcements to channels you configure.

The bot does **not** invoke SpacetimeDB reducers; it only subscribes to tables and listens for committed game events.

**Disclaimer:** FORGE is independent, community-maintained software. It is **not** affiliated with, endorsed by, or supported by Clockwork Labs, BitCraft, Discord, or SpacetimeDB.

Licensed under the [MIT License](LICENSE). See [SECURITY.md](SECURITY.md) for how to report security issues responsibly.

## Features

- **Per-channel scope** — Each Discord text channel can be enabled independently (`/forge enable`), with its own monitors, announcement target, and leaderboard data.
- **Monitors** — Track BitCraft **claims** and **barter buildings** (stall vs counter is inferred from game data).
- **Quest board** — Lists active barter offers for buildings monitored in that channel’s scope.
- **Leaderboard** — Ranks members by **quest completions** recorded when a barter completes at a monitored building.
- **Announcements** — Optional text/announcement channel for debounced embeds when offers change or complete.

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

## Discord commands

Commands are registered when the bot starts: **guild** commands if `FORGE_DISCORD_GUILD_ID` is set, otherwise **global** commands (Discord can take up to about an hour to propagate global commands).

Unless noted, use commands in a **server text channel**. **Manage Server** is Discord’s permission name for the API’s “manage guild” check.


| Command                    | Description                                                                  | Permission                       |
| -------------------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| `/forge health`            | Forge version and connection status (works in DMs)                           | Anyone (ephemeral; works in DMs) |
| `/forge enable`            | Turn on Forge for this channel's scope                                       | Manage Server                    |
| `/forge disable`           | Turn off Forge for this channel's scope and clear its data                    | Manage Server                    |
| `/forge quest board`       | Active barter offers for this channel's scope                                 | Anyone (channel must be enabled) |
| `/forge quest leaderboard` | Quest leaderboard for this channel's scope                                  | Anyone (channel must be enabled) |
| `/forge quest reset-leaderboard` | Clear the quest leaderboard for this channel's scope                    | Manage Server (channel must be enabled) |
| `/forge channel set`       | Set or clear where barter and quest messages post for this channel's scope    | Manage Server                    |
| `/forge claim add`         | Watch a claim for this channel's scope (`claim_id`)                          | Manage Server                    |
| `/forge claim remove`      | Stop watching a claim for this channel's scope                               | Manage Server                    |
| `/forge claim list`        | Claims watched for this channel's scope                                        | Manage Server                    |
| `/forge building add`      | Watch a barter building for this channel's scope (`building_id`)               | Manage Server                    |
| `/forge building remove`   | Stop watching a building for this channel's scope                              | Manage Server                    |
| `/forge building list`     | Barter buildings watched for this channel's scope                              | Manage Server                    |


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
  - `FORGE_DATABASE_URL` — PostgreSQL connection string.
  - `FORGE_BITCRAFT_WS_URI`, `FORGE_BITCRAFT_MODULE`, `FORGE_BITCRAFT_JWT` — BitCraft SpacetimeDB endpoint and session token.
   Optional variables (debounce timings, quest banner URL, guild-scoped slash registration, etc.) are documented in `.env.example`.
3. **Start PostgreSQL** — For example, from the repo root: `docker compose up -d` using [docker-compose.yml](docker-compose.yml), then point `FORGE_DATABASE_URL` at that instance.
4. **Run the app** — Migrations apply on startup.

   ```bash
   pnpm dev
   ```

   Other useful commands:

   ```bash
   pnpm test        # Vitest across workspace packages
   pnpm typecheck   # TypeScript
   pnpm start       # production-style start (forge app)
   pnpm db:generate # emit SQL after schema changes (needs FORGE_DATABASE_URL)
   ```

5. **Develop with one guild** — Set `FORGE_DISCORD_GUILD_ID` so slash commands register immediately for that server instead of globally.

## Project layout

Monorepo: runnable app in `apps/forge`; shared libraries in `packages/` (`@forge/config`, `@forge/domain`, `@forge/db`, `@forge/repos`, `@forge/application`, `@forge/discord-forge`, `@forge/logger`). The SpacetimeDB client uses `@clockworklabs/spacetimedb-sdk` **1.3.x** with a small [pnpm patch](patches/@clockworklabs__spacetimedb-sdk@1.3.3.patch) aligned to the vendored bindings.