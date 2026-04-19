import { describe, expect, it, vi } from "vitest";
import {
  executeForgeDisable,
  executeForgeEnable,
} from "./forgeChannelEnable.js";

describe("executeForgeEnable", () => {
  it("returns success copy when enable returns ok", async () => {
    const deps = {
      repo: {
        enableForgeChannel: vi.fn().mockResolvedValue("ok"),
        disableForgeChannel: vi.fn(),
      },
    };
    const { content } = await executeForgeEnable("g1", "c1", deps);
    expect(content).toContain("BitCraft Forge is enabled");
    expect(content).toContain("quest scoring");
    expect(deps.repo.enableForgeChannel).toHaveBeenCalledWith("g1", "c1");
  });

  it("returns duplicate copy when channel already enabled", async () => {
    const deps = {
      repo: {
        enableForgeChannel: vi.fn().mockResolvedValue("duplicate"),
        disableForgeChannel: vi.fn(),
      },
    };
    const { content } = await executeForgeEnable("g1", "c1", deps);
    expect(content).toContain("already enabled");
  });
});

describe("executeForgeDisable", () => {
  it("returns removed copy when disable returns true", async () => {
    const deps = {
      repo: {
        enableForgeChannel: vi.fn(),
        disableForgeChannel: vi.fn().mockResolvedValue(true),
      },
    };
    const { content } = await executeForgeDisable("g1", "c1", deps);
    expect(content).toContain("disabled for this channel");
    expect(deps.repo.disableForgeChannel).toHaveBeenCalledWith("g1", "c1");
  });

  it("returns nothing-to-disable when disable returns false", async () => {
    const deps = {
      repo: {
        enableForgeChannel: vi.fn(),
        disableForgeChannel: vi.fn().mockResolvedValue(false),
      },
    };
    const { content } = await executeForgeDisable("g1", "c1", deps);
    expect(content).toContain("nothing to disable");
  });
});
