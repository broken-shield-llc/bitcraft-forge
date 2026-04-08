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
});
