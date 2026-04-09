import { normalizeScopedId } from "@forge/domain";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";

export type ClaimCommandsDeps = {
  repo: Pick<GuildConfigRepository, "listClaims" | "addClaim" | "removeClaim">;
  entityCacheRepo: Pick<EntityCacheRepository, "getClaimName">;
};

export async function executeClaimList(
  discordGuildId: string,
  forgeChannelId: string,
  deps: ClaimCommandsDeps
): Promise<{ content: string }> {
  const claims = await deps.repo.listClaims(discordGuildId, forgeChannelId);
  if (claims.length === 0) {
    return {
      content:
        "No claims are being monitored yet. Use `/forge claim add`.",
    };
  }
  const claimLines = await Promise.all(
    claims.map(async (c) => {
      const name = await deps.entityCacheRepo.getClaimName(c);
      return name ? `• \`${c}\` — ${name}` : `• \`${c}\``;
    })
  );
  return {
    content: `**Monitored claims (${claims.length})**\n${claimLines.join("\n")}`,
  };
}

export async function executeClaimAdd(
  discordGuildId: string,
  forgeChannelId: string,
  rawClaimId: string,
  deps: Pick<ClaimCommandsDeps, "repo">
): Promise<{ content: string }> {
  const claimId = normalizeScopedId(rawClaimId);
  if (!claimId) {
    return {
      content:
        "Invalid `claim_id` (empty or too long, max 128 characters).",
    };
  }
  const r = await deps.repo.addClaim(discordGuildId, forgeChannelId, claimId);
  return {
    content:
      r === "duplicate"
        ? `Claim \`${claimId}\` is already monitored.`
        : `Now monitoring claim \`${claimId}\`.`,
  };
}

export async function executeClaimRemove(
  discordGuildId: string,
  forgeChannelId: string,
  rawClaimId: string,
  deps: Pick<ClaimCommandsDeps, "repo">
): Promise<{ content: string }> {
  const claimId = normalizeScopedId(rawClaimId);
  if (!claimId) {
    return {
      content:
        "Invalid `claim_id` (empty or too long, max 128 characters).",
    };
  }
  const removed = await deps.repo.removeClaim(
    discordGuildId,
    forgeChannelId,
    claimId
  );
  return {
    content: removed
      ? `Stopped monitoring claim \`${claimId}\`.`
      : `Claim \`${claimId}\` was not in the monitor list.`,
  };
}
