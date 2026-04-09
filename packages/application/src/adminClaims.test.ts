import { describe, expect, it, vi } from "vitest";
import { executeClaimAdd } from "./adminClaims.js";

function claimRepo(partial: { addClaim: ReturnType<typeof vi.fn> }) {
  return {
    listClaims: vi.fn(),
    removeClaim: vi.fn(),
    ...partial,
  };
}

describe("executeClaimAdd", () => {
  it("rejects empty claim_id", async () => {
    const repo = claimRepo({ addClaim: vi.fn() });
    const { content } = await executeClaimAdd("g1", "   ", { repo });
    expect(content).toContain("Invalid `claim_id`");
    expect(repo.addClaim).not.toHaveBeenCalled();
  });

  it("rejects claim_id over max length", async () => {
    const repo = claimRepo({ addClaim: vi.fn() });
    const { content } = await executeClaimAdd("g1", "z".repeat(129), {
      repo,
    });
    expect(content).toContain("Invalid `claim_id`");
    expect(repo.addClaim).not.toHaveBeenCalled();
  });

  it("returns duplicate when addClaim returns duplicate", async () => {
    const repo = claimRepo({
      addClaim: vi.fn().mockResolvedValue("duplicate"),
    });
    const { content } = await executeClaimAdd("g1", "claim-1", { repo });
    expect(content).toContain("already monitored");
    expect(repo.addClaim).toHaveBeenCalledWith("g1", "claim-1");
  });

  it("returns ok message when claim is added", async () => {
    const repo = claimRepo({ addClaim: vi.fn().mockResolvedValue("ok") });
    const { content } = await executeClaimAdd("g1", "claim-2", { repo });
    expect(content).toContain("Now monitoring claim");
    expect(content).toContain("claim-2");
    expect(repo.addClaim).toHaveBeenCalledWith("g1", "claim-2");
  });
});
