import { describe, expect, it } from "vitest";
import { loadForgeConfig } from "./config.js";

describe("loadForgeConfig", () => {
  it("fails when required FORGE_* keys are missing", () => {
    const r = loadForgeConfig({});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.map((e) => e.key)).toContain("FORGE_DISCORD_TOKEN");
  });

  it("accepts a minimal valid set", () => {
    const r = loadForgeConfig({
      FORGE_DISCORD_TOKEN: "x",
      FORGE_DISCORD_APPLICATION_ID: "1",
      FORGE_BITCRAFT_WS_URI: "wss://example.test",
      FORGE_BITCRAFT_MODULE: "bitcraft-1",
      FORGE_BITCRAFT_JWT: "jwt",
      FORGE_DATABASE_URL: "postgresql://u:p@localhost:5432/forge",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.bitcraftModule).toBe("bitcraft-1");
    expect(r.config.questSuppressUpdateAfterCompleteMs).toBe(
      r.config.questDiscordDebounceMs + 3000
    );
    expect(r.config.healthListenPort).toBeUndefined();
  });

  it("accepts FORGE_HEALTH_PORT", () => {
    const r = loadForgeConfig({
      FORGE_DISCORD_TOKEN: "x",
      FORGE_DISCORD_APPLICATION_ID: "1",
      FORGE_BITCRAFT_WS_URI: "wss://x",
      FORGE_BITCRAFT_MODULE: "m",
      FORGE_BITCRAFT_JWT: "j",
      FORGE_DATABASE_URL: "postgresql://u:p@localhost:5432/x",
      FORGE_HEALTH_PORT: "8080",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.healthListenPort).toBe(8080);
  });

  it("rejects invalid FORGE_HEALTH_PORT", () => {
    const r = loadForgeConfig({
      FORGE_DISCORD_TOKEN: "x",
      FORGE_DISCORD_APPLICATION_ID: "1",
      FORGE_BITCRAFT_WS_URI: "wss://x",
      FORGE_BITCRAFT_MODULE: "m",
      FORGE_BITCRAFT_JWT: "j",
      FORGE_DATABASE_URL: "postgresql://u:p@localhost:5432/x",
      FORGE_HEALTH_PORT: "0",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects bad FORGE_LOG_LEVEL", () => {
    const r = loadForgeConfig({
      FORGE_DISCORD_TOKEN: "x",
      FORGE_DISCORD_APPLICATION_ID: "1",
      FORGE_BITCRAFT_WS_URI: "wss://x",
      FORGE_BITCRAFT_MODULE: "m",
      FORGE_BITCRAFT_JWT: "j",
      FORGE_DATABASE_URL: "postgresql://u:p@localhost:5432/x",
      FORGE_LOG_LEVEL: "verbose",
    });
    expect(r.ok).toBe(false);
  });

  it("accepts composite Postgres settings (e.g. ECS + RDS secret keys)", () => {
    const r = loadForgeConfig({
      FORGE_DISCORD_TOKEN: "x",
      FORGE_DISCORD_APPLICATION_ID: "1",
      FORGE_BITCRAFT_WS_URI: "wss://example.test",
      FORGE_BITCRAFT_MODULE: "bitcraft-1",
      FORGE_BITCRAFT_JWT: "jwt",
      FORGE_DATABASE_HOST: "db.example.aws",
      FORGE_DATABASE_USER: "forge",
      FORGE_DATABASE_PASSWORD: "s:ec@ret",
      FORGE_DATABASE_NAME: "forge",
      FORGE_DATABASE_PORT: "5432",
      FORGE_DATABASE_SSLMODE: "require",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.databaseUrl).toBe(
      "postgresql://forge:s%3Aec%40ret@db.example.aws:5432/forge?sslmode=require"
    );
  });

});
