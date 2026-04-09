# bitcraft-forge

FORGE (Flow Orchestration & Relay for Game Events) — BitCraft Online community tooling. **Architecture, phases, and PoC scope:** [docs/FORGE_PLAN.md](docs/FORGE_PLAN.md).

## Phase 0 (proof of concept)

**Requirements:** Node.js 20+, `git`, [pnpm](https://pnpm.io/installation) 9+ (Corepack: `corepack enable` then the repo’s `packageManager` field pins the version), **Postgres** for Phase 1+.

1. Copy [`.env.example`](.env.example) to `.env` at the **repo root** (or `apps/forge/.env`) and set all required `FORGE_*` variables. The app loads the first file that exists in that order. Optional: `FORGE_DISCORD_GUILD_ID` to register slash commands on one guild during development.
2. Start Postgres, e.g. `docker compose up -d` using [docker-compose.yml](docker-compose.yml), then set `FORGE_DATABASE_URL` (see `.env.example`). On first `pnpm dev` / `pnpm start`, migrations in `packages/db/drizzle/` run automatically. After editing `packages/db/src/schema.ts`, run `pnpm db:generate` from the repo root to emit new SQL (Drizzle reads `FORGE_DATABASE_URL` from the environment).
3. From the repo root: `pnpm install` — this runs `prepare`, which clones [BitCraft_Bindings](https://github.com/BitCraftToolBox/BitCraft_Bindings) (`ts-region`) into `apps/forge/vendor/BitCraft_Bindings` (ignored by git). To skip the clone (e.g. CI): `FORGE_SKIP_BINDINGS_CLONE=1 pnpm install`.
4. `pnpm test` — runs Vitest across workspace packages (config + domain tests; no live Discord, SpacetimeDB, or Postgres required).
5. `pnpm dev` — SpacetimeDB subscriber + Discord bot. Slash commands include `/forge health`; `/forge quest board` & `/forge quest leaderboard` (guild, no admin gate); quest completions are recorded when a committed **`barter_stall_order_accept`** event targets a **monitored** building (leaderboard labels SpacetimeDB callers as STDB identity hex); optional `/forge quest complete` for manual Discord-only logging; `/forge channel set` for debounced barter embeds (**Manage Server**); `/forge claim …` & `/forge building …` (**Manage Server**). Use commands in a guild except `/forge health` (works in DMs).

SpacetimeDB client: generated BitCraft bindings target `@clockworklabs/spacetimedb-sdk@1.3.3` (see [docs/FORGE_PLAN.md](docs/FORGE_PLAN.md)); use a JWT from the [BitCraft auth flow](https://bitcraft.trinit.is/docs/intro).

**Discord `401 Unauthorized`:** `FORGE_DISCORD_TOKEN` must be the **Bot** token from Developer Portal → your application → **Bot** (not the OAuth2 client secret). `FORGE_DISCORD_APPLICATION_ID` must be that same app’s **Application ID** (General Information, same as OAuth2 “Client ID”). Regenerate the bot token if it was reset elsewhere.