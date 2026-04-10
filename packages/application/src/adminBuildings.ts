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
    | "getBuildingNickname"
    | "getClaimName"
    | "inferBuildingKindFromCachedEntity"
  >;
  /** Slash root (e.g. `forge`). Defaults to `forge`. */
  discordCommandName?: string;
};

export async function executeBuildingList(
  discordGuildId: string,
  forgeChannelId: string,
  deps: BuildingCommandsDeps
): Promise<{ content: string }> {
  const cmd = deps.discordCommandName ?? "forge";
  const buildings = await deps.repo.listBuildings(
    discordGuildId,
    forgeChannelId
  );
  if (buildings.length === 0) {
    return {
      content: `No buildings are being monitored yet. Use \`/${cmd} building add\`.`,
    };
  }
  const nickMap = await deps.entityCacheRepo.getBuildingNicknames(
    buildings.map((b) => b.buildingId)
  );
  const buildingLines = await Promise.all(
    buildings.map(async (b) => {
      const rawNick = nickMap.get(b.buildingId)?.trim();
      const buildingName =
        rawNick && rawNick.length > 0 ? `**${rawNick}**` : "—";
      const kind = formatBuildingKind(b.kind);
      let claimPart = "";
      if (b.claimId) {
        const cname = await deps.entityCacheRepo.getClaimName(b.claimId);
        const cn = cname?.trim();
        claimPart = cn ? ` in **${cn}**` : " in —";
      }
      return `* ${buildingName} (\`${b.buildingId}\`) [${kind}]${claimPart}`;
    })
  );
  return {
    content: `**Monitored buildings (${buildings.length})**\n${buildingLines.join("\n")}`,
  };
}

export type BuildingAddInput = {
  rawBuildingId: string;
};

export async function executeBuildingAdd(
  discordGuildId: string,
  forgeChannelId: string,
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

  const kind =
    await deps.entityCacheRepo.inferBuildingKindFromCachedEntity(buildingId);
  if (!kind) {
    return {
      content:
        "Could not determine **Barter Stall** vs **Barter Counter** yet. Forge needs cached `building_state` and `building_desc` rows from SpacetimeDB for this id—wait a few seconds after the bot is connected, then try again. If this persists, verify the building id.",
    };
  }

  let buildingName = "—";
  try {
    const nick = await deps.entityCacheRepo.getBuildingNickname(buildingId);
    const t = nick?.trim();
    if (t) buildingName = `**${t}**`;
  } catch {
    void 0;
  }
  const kindLabel = formatBuildingKind(kind);
  const line = `${buildingName} (\`${buildingId}\`) [${kindLabel}]`;
  const r = await deps.repo.addBuilding(
    discordGuildId,
    forgeChannelId,
    buildingId,
    kind,
    undefined
  );
  return {
    content:
      r === "duplicate"
        ? `${line} is already monitored.`
        : `Now monitoring ${line}`,
  };
}

export async function executeBuildingRemove(
  discordGuildId: string,
  forgeChannelId: string,
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
  const removed = await deps.repo.removeBuilding(
    discordGuildId,
    forgeChannelId,
    buildingId
  );
  return {
    content: removed
      ? `Stopped monitoring ${buildingLabel}.`
      : `${buildingLabel} was not in the monitor list.`,
  };
}
