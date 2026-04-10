import { describe, expect, it, vi } from "vitest";
import { executeClaimAdd, executeClaimRemove } from "./adminClaims.js";

function claimRepo(partial: { addClaim: ReturnType<typeof vi.fn> }) {
  return {
    listClaims: vi.fn(),
    removeClaim: vi.fn(),
    ...partial,
  };
}

function claimEntityCache(partial?: {
  getClaimName?: ReturnType<typeof vi.fn>;
}) {
  return {
    getClaimName: vi.fn().mockResolvedValue(undefined),
    ...partial,
  };
}

describe("executeClaimAdd", () => {
  it("rejects empty claim_id", async () => {
    const repo = claimRepo({ addClaim: vi.fn() });
    const entityCacheRepo = claimEntityCache();
    const { content } = await executeClaimAdd("g1", "c1", "   ", {
      repo,
      entityCacheRepo,
    });
    expect(content).toContain("Invalid `claim_id`");
    expect(repo.addClaim).not.toHaveBeenCalled();
  });

  it("rejects claim_id over max length", async () => {
    const repo = claimRepo({ addClaim: vi.fn() });
    const entityCacheRepo = claimEntityCache();
    const { content } = await executeClaimAdd("g1", "c1", "z".repeat(129), {
      repo,
      entityCacheRepo,
    });
    expect(content).toContain("Invalid `claim_id`");
    expect(repo.addClaim).not.toHaveBeenCalled();
  });

  it("returns duplicate when addClaim returns duplicate", async () => {
    const repo = claimRepo({
      addClaim: vi.fn().mockResolvedValue("duplicate"),
    });
    const entityCacheRepo = claimEntityCache();
    const { content } = await executeClaimAdd("g1", "c1", "claim-1", {
      repo,
      entityCacheRepo,
    });
    expect(content).toContain("already monitored");
    expect(repo.addClaim).toHaveBeenCalledWith("g1", "c1", "claim-1");
  });

  it("returns ok message when claim is added", async () => {
    const repo = claimRepo({ addClaim: vi.fn().mockResolvedValue("ok") });
    const entityCacheRepo = claimEntityCache();
    const { content } = await executeClaimAdd("g1", "c1", "claim-2", {
      repo,
      entityCacheRepo,
    });
    expect(content).toContain("Now monitoring");
    expect(content).toContain("claim-2");
    expect(repo.addClaim).toHaveBeenCalledWith("g1", "c1", "claim-2");
  });

  it("includes claim name in add message when available", async () => {
    const repo = claimRepo({ addClaim: vi.fn().mockResolvedValue("ok") });
    const entityCacheRepo = claimEntityCache({
      getClaimName: vi.fn().mockResolvedValue("Shimmer Bay"),
    });
    const { content } = await executeClaimAdd("g1", "c1", "claim-3", {
      repo,
      entityCacheRepo,
    });
    expect(content).toContain("Now monitoring Shimmer Bay (`claim-3`).");
  });
});

describe("executeClaimRemove", () => {
  it("uses claim name in remove message when available", async () => {
    const repo = {
      listClaims: vi.fn(),
      addClaim: vi.fn(),
      removeClaim: vi.fn().mockResolvedValue(true),
    };
    const entityCacheRepo = claimEntityCache({
      getClaimName: vi.fn().mockResolvedValue("Solspire"),
    });
    const { content } = await executeClaimRemove("g1", "c1", "claim-9", {
      repo,
      entityCacheRepo,
    });
    expect(content).toBe("Stopped monitoring Solspire (`claim-9`).");
  });

  it("falls back to id when claim name is unavailable", async () => {
    const repo = {
      listClaims: vi.fn(),
      addClaim: vi.fn(),
      removeClaim: vi.fn().mockResolvedValue(true),
    };
    const entityCacheRepo = claimEntityCache();
    const { content } = await executeClaimRemove("g1", "c1", "claim-10", {
      repo,
      entityCacheRepo,
    });
    expect(content).toBe("Stopped monitoring `claim-10`.");
  });
});
