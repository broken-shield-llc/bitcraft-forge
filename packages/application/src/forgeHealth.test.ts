import { describe, expect, it } from "vitest";
import {
  buildForgeHealthContent,
  type ForgeHealthViewInput,
} from "./forgeHealth.js";

const baseHealth: ForgeHealthViewInput["health"] = {
  connected: true,
  identityHex: "abc123",
  subscriptionApplied: true,
  tradeOrderRowCount: 50,
  travelerTradeDescRowCount: 12,
  lastError: null,
};

function input(
  overrides: Partial<ForgeHealthViewInput> = {}
): ForgeHealthViewInput {
  const {
    health: healthOverride,
    bitcraftWsUri = "wss://example.test/stdb",
    bitcraftModule = "bitcraft-1",
    bitcraftJwtSet = true,
    nodeVersion = "v22.0.0",
  } = overrides;
  return {
    bitcraftWsUri,
    bitcraftModule,
    bitcraftJwtSet,
    nodeVersion,
    health: { ...baseHealth, ...healthOverride },
  };
}

describe("buildForgeHealthContent", () => {
  it("includes core config and STDB snapshot fields", () => {
    const content = buildForgeHealthContent(input());
    expect(content).toContain("**FORGE**");
    expect(content).toContain("`wss://example.test/stdb`");
    expect(content).toContain("`bitcraft-1`");
    expect(content).toContain("BitCraft JWT: **set**");
    expect(content).toContain("`v22.0.0`");
    expect(content).toContain("SpacetimeDB connected: **true**");
    expect(content).toContain("`abc123`");
    expect(content).toContain("Quest projection ready: **true**");
    expect(content).toContain("`trade_order_state`");
    expect(content).toContain("**50**");
    expect(content).toContain("`traveler_trade_order_desc`");
    expect(content).toContain("**12**");
  });

  it("appends last STDB error when present", () => {
    const content = buildForgeHealthContent(
      input({ health: { ...baseHealth, lastError: "timeout" } })
    );
    expect(content).toContain("Last STDB error");
    expect(content).toContain("timeout");
  });

  it("hints JWT when missing", () => {
    const content = buildForgeHealthContent(
      input({ bitcraftJwtSet: false, health: { ...baseHealth } })
    );
    expect(content).toContain("BitCraft JWT: **missing**");
    expect(content).toContain("FORGE_BITCRAFT_JWT");
  });

  it("hints connection when JWT set but disconnected", () => {
    const content = buildForgeHealthContent(
      input({
        bitcraftJwtSet: true,
        health: { ...baseHealth, connected: false },
      })
    );
    expect(content).toContain("SpacetimeDB connected: **false**");
    expect(content).toContain("onConnectError");
  });
});
