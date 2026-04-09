import {
  formatBuildingDisplayLabel,
  formatBuildingKind,
  normalizeScopedId,
} from "@forge/domain";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";

export type BuildingCommandsDeps = {
  repo: Pick<
    GuildConfigRepository,
    "listBuildings" | "addBuilding" | "removeBuilding"
  >;
  entityCacheRepo: Pick<
    EntityCacheRepository,
    | "getBuildingNicknames"
    | "getBuildingSummary"
    | "getBuildingNickname"
    | "inferBuildingKindFromCachedEntity"
  >;
};

export async function executeBuildingList(
  discordGuildId: string,
  deps: BuildingCommandsDeps
): Promise<{ content: string }> {
  const buildings = await deps.repo.listBuildings(discordGuildId);
  if (buildings.length === 0) {
    return {
      content:
        "No buildings are being monitored yet. Use `/forge building add`.",
    };
  }
  const nickMap = await deps.entityCacheRepo.getBuildingNicknames(
    buildings.map((b) => b.buildingId)
  );
  const buildingLines = await Promise.all(
    buildings.map(async (b) => {
      const summary = await deps.entityCacheRepo.getBuildingSummary(
        b.buildingId
      );
      const kind = formatBuildingKind(b.kind);
      const claimPart = b.claimId ? ` — claim \`${b.claimId}\`` : "";
      const extra = summary ? ` · ${summary}` : "";
      return `• ${formatBuildingDisplayLabel(b.buildingId, nickMap.get(b.buildingId))} (${kind})${claimPart}${extra}`;
    })
  );
  return {
    content: `**Monitored buildings (${buildings.length})**\n${buildingLines.join("\n")}`,
  };
}

export type BuildingAddInput = {
  rawBuildingId: string;
  rawClaimId: string | null;
};

export async function executeBuildingAdd(
  discordGuildId: string,
  input: BuildingAddInput,
  deps: BuildingCommandsDeps
): Promise<{ content: string }> {
  const buildingId = normalizeScopedId(input.rawBuildingId);
  if (!buildingId) {
    return {
      content:
        "Invalid `building_id` (empty or too long, max 128 characters).",
    };
  }

  const rawOptClaim = input.rawClaimId;
  const optClaim =
    rawOptClaim === null ? undefined : normalizeScopedId(rawOptClaim);
  if (rawOptClaim !== null && rawOptClaim.trim() !== "" && !optClaim) {
    return {
      content:
        "Invalid optional `claim_id` (too long, max 128 characters).",
    };
  }

  const claimRef = optClaim ?? undefined;

  const kind =
    await deps.entityCacheRepo.inferBuildingKindFromCachedEntity(buildingId);
  if (!kind) {
    return {
      content:
        "Could not determine **Barter Stall** vs **Barter Counter** yet. Forge needs cached `building_state` and `building_desc` rows from SpacetimeDB for this id—wait a few seconds after the bot is connected, then try again. If this persists, verify the building id.",
    };
  }

  let buildingLabel: string;
  try {
    const nick = await deps.entityCacheRepo.getBuildingNickname(buildingId);
    buildingLabel = formatBuildingDisplayLabel(buildingId, nick);
  } catch {
    buildingLabel = formatBuildingDisplayLabel(buildingId, undefined);
  }
  const r = await deps.repo.addBuilding(
    discordGuildId,
    buildingId,
    kind,
    claimRef
  );
  return {
    content:
      r === "duplicate"
        ? `Building ${buildingLabel} is already monitored.`
        : `Now monitoring ${buildingLabel} as **${formatBuildingKind(kind)}**${claimRef ? ` (claim \`${claimRef}\`)` : ""}.`,
  };
}

export async function executeBuildingRemove(
  discordGuildId: string,
  rawBuildingId: string,
  deps: BuildingCommandsDeps
): Promise<{ content: string }> {
  const buildingId = normalizeScopedId(rawBuildingId);
  if (!buildingId) {
    return {
      content:
        "Invalid `building_id` (empty or too long, max 128 characters).",
    };
  }

  let buildingLabel: string;
  try {
    const nick = await deps.entityCacheRepo.getBuildingNickname(buildingId);
    buildingLabel = formatBuildingDisplayLabel(buildingId, nick);
  } catch {
    buildingLabel = formatBuildingDisplayLabel(buildingId, undefined);
  }
  const removed = await deps.repo.removeBuilding(discordGuildId, buildingId);
  return {
    content: removed
      ? `Stopped monitoring ${buildingLabel}.`
      : `${buildingLabel} was not in the monitor list.`,
  };
}
