import { normalizeScopedId } from "@forge/domain";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";

export type ClaimCommandsDeps = {
  repo: Pick<GuildConfigRepository, "listClaims" | "addClaim" | "removeClaim">;
  entityCacheRepo: Pick<EntityCacheRepository, "getClaimName">;
};

function formatClaimDisplayLabel(claimId: string, claimName?: string): string {
  return claimName ? `${claimName} (\`${claimId}\`)` : `\`${claimId}\``;
}

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
  deps: Pick<ClaimCommandsDeps, "repo" | "entityCacheRepo">
): Promise<{ content: string }> {
  const claimId = normalizeScopedId(rawClaimId);
  if (!claimId) {
    return {
      content:
        "Invalid `claim_id` (empty or too long, max 128 characters).",
    };
  }
  const r = await deps.repo.addClaim(discordGuildId, forgeChannelId, claimId);
  let claimLabel = formatClaimDisplayLabel(claimId);
  try {
    const claimName = await deps.entityCacheRepo.getClaimName(claimId);
    claimLabel = formatClaimDisplayLabel(claimId, claimName ?? undefined);
  } catch {
    void 0;
  }
  return {
    content:
      r === "duplicate"
        ? `${claimLabel} is already monitored.`
        : `Now monitoring ${claimLabel}.`,
  };
}

export async function executeClaimRemove(
  discordGuildId: string,
  forgeChannelId: string,
  rawClaimId: string,
  deps: Pick<ClaimCommandsDeps, "repo" | "entityCacheRepo">
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
  let claimLabel = formatClaimDisplayLabel(claimId);
  try {
    const claimName = await deps.entityCacheRepo.getClaimName(claimId);
    claimLabel = formatClaimDisplayLabel(claimId, claimName ?? undefined);
  } catch {
    void 0;
  }
  return {
    content: removed
      ? `Stopped monitoring ${claimLabel}.`
      : `${claimLabel} was not in the monitor list.`,
  };
}
