import { and, asc, desc, eq, sum } from "drizzle-orm";
import {
  computeLeaderboardPoints,
  DEFAULT_QUEST_SCORING_WEIGHTS,
  mergeQuestScoringWeights,
  normalizeStoredBuildingKind,
  parseQuestLeaderboardScoringMode,
} from "@forge/domain";
import type {
  BuildingKind,
  ItemStackLike,
  QuestLeaderboardScoringMode,
} from "@forge/domain";
import { type ForgeDb, isPgUniqueViolation, schema } from "@forge/db";
import type {
  AddResult,
  GuildConfigRepository,
  MonitoredBuildingRow,
  MonitoredBuildingScopePair,
  QuestAnnouncementKind,
  QuestAnnouncementOverrideTarget,
  QuestAnnouncementRouting,
  QuestAnnouncementRoutingSource,
  QuestLeaderboardRow,
  RecordQuestCompletionInput,
  QuestScoringConfigView,
} from "./guildConfigRepository.js";

function parseCompletionStacks(raw: unknown): ItemStackLike[] {
  if (!Array.isArray(raw)) return [];
  const out: ItemStackLike[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    const o = el as { itemId?: unknown; quantity?: unknown };
    if (typeof o.itemId !== "number" || !Number.isFinite(o.itemId)) continue;
    if (typeof o.quantity !== "number" || !Number.isFinite(o.quantity)) continue;
    out.push({ itemId: o.itemId, quantity: o.quantity });
  }
  return out;
}

export class DrizzleGuildConfigRepository implements GuildConfigRepository {
  constructor(private readonly db: ForgeDb) {}

  private async ensureGuild(discordGuildId: string): Promise<void> {
    await this.db
      .insert(schema.discordGuilds)
      .values({ discordGuildId })
      .onConflictDoNothing({ target: schema.discordGuilds.discordGuildId });
  }

  async isForgeChannelEnabled(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<boolean> {
    const rows = await this.db
      .select({ one: schema.forgeEnabledChannels.discordChannelId })
      .from(schema.forgeEnabledChannels)
      .where(
        and(
          eq(schema.forgeEnabledChannels.discordGuildId, discordGuildId),
          eq(schema.forgeEnabledChannels.discordChannelId, forgeChannelId)
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async enableForgeChannel(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<AddResult> {
    await this.ensureGuild(discordGuildId);
    try {
      await this.db.insert(schema.forgeEnabledChannels).values({
        discordGuildId,
        discordChannelId: forgeChannelId,
        announcementChannelId: forgeChannelId,
        questLeaderboardScoringMode: "default",
        questScoringWeights: { ...DEFAULT_QUEST_SCORING_WEIGHTS },
      });
      return "ok";
    } catch (e: unknown) {
      if (isPgUniqueViolation(e)) return "duplicate";
      throw e;
    }
  }

  async disableForgeChannel(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<boolean> {
    const deleted = await this.db
      .delete(schema.forgeEnabledChannels)
      .where(
        and(
          eq(schema.forgeEnabledChannels.discordGuildId, discordGuildId),
          eq(schema.forgeEnabledChannels.discordChannelId, forgeChannelId)
        )
      )
      .returning({ discordChannelId: schema.forgeEnabledChannels.discordChannelId });
    return deleted.length > 0;
  }

  async addClaim(
    discordGuildId: string,
    forgeChannelId: string,
    claimId: string
  ): Promise<AddResult> {
    await this.ensureGuild(discordGuildId);
    try {
      await this.db.insert(schema.monitoredClaims).values({
        discordGuildId,
        forgeChannelId,
        claimId,
      });
      return "ok";
    } catch (e: unknown) {
      if (isPgUniqueViolation(e)) return "duplicate";
      throw e;
    }
  }

  async removeClaim(
    discordGuildId: string,
    forgeChannelId: string,
    claimId: string
  ): Promise<boolean> {
    const deleted = await this.db
      .delete(schema.monitoredClaims)
      .where(
        and(
          eq(schema.monitoredClaims.discordGuildId, discordGuildId),
          eq(schema.monitoredClaims.forgeChannelId, forgeChannelId),
          eq(schema.monitoredClaims.claimId, claimId)
        )
      )
      .returning({ id: schema.monitoredClaims.id });
    return deleted.length > 0;
  }

  async listClaims(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<string[]> {
    const rows = await this.db
      .select({ claimId: schema.monitoredClaims.claimId })
      .from(schema.monitoredClaims)
      .where(
        and(
          eq(schema.monitoredClaims.discordGuildId, discordGuildId),
          eq(schema.monitoredClaims.forgeChannelId, forgeChannelId)
        )
      );
    return [...new Set(rows.map((r) => r.claimId))].sort();
  }

  async addBuilding(
    discordGuildId: string,
    forgeChannelId: string,
    buildingId: string,
    kind: BuildingKind,
    claimId?: string
  ): Promise<AddResult> {
    await this.ensureGuild(discordGuildId);
    try {
      await this.db.insert(schema.monitoredBuildings).values({
        discordGuildId,
        forgeChannelId,
        buildingId,
        kind,
        claimId: claimId ?? null,
      });
      return "ok";
    } catch (e: unknown) {
      if (isPgUniqueViolation(e)) return "duplicate";
      throw e;
    }
  }

  async removeBuilding(
    discordGuildId: string,
    forgeChannelId: string,
    buildingId: string
  ): Promise<boolean> {
    const deleted = await this.db
      .delete(schema.monitoredBuildings)
      .where(
        and(
          eq(schema.monitoredBuildings.discordGuildId, discordGuildId),
          eq(schema.monitoredBuildings.forgeChannelId, forgeChannelId),
          eq(schema.monitoredBuildings.buildingId, buildingId)
        )
      )
      .returning({ id: schema.monitoredBuildings.id });
    return deleted.length > 0;
  }

  async listBuildings(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<MonitoredBuildingRow[]> {
    const rows = await this.db
      .select({
        buildingId: schema.monitoredBuildings.buildingId,
        kind: schema.monitoredBuildings.kind,
        claimId: schema.monitoredBuildings.claimId,
      })
      .from(schema.monitoredBuildings)
      .where(
        and(
          eq(schema.monitoredBuildings.discordGuildId, discordGuildId),
          eq(schema.monitoredBuildings.forgeChannelId, forgeChannelId)
        )
      );

    return rows
      .map((r) => ({
        buildingId: r.buildingId,
        kind: normalizeStoredBuildingKind(r.kind),
        claimId: r.claimId ?? undefined,
      }))
      .sort((a, b) => a.buildingId.localeCompare(b.buildingId));
  }

  async setAnnouncementChannel(
    discordGuildId: string,
    forgeChannelId: string,
    channelId: string | null
  ): Promise<void> {
    await this.ensureGuild(discordGuildId);
    await this.db
      .update(schema.forgeEnabledChannels)
      .set({ announcementChannelId: channelId })
      .where(
        and(
          eq(schema.forgeEnabledChannels.discordGuildId, discordGuildId),
          eq(schema.forgeEnabledChannels.discordChannelId, forgeChannelId)
        )
      );
  }

  async setQuestAnnouncementOverride(
    discordGuildId: string,
    forgeChannelId: string,
    target: QuestAnnouncementOverrideTarget,
    channelId: string | null
  ): Promise<void> {
    await this.ensureGuild(discordGuildId);
    const patch =
      target === "quest_added"
        ? { questAddedChannelId: channelId }
        : target === "quest_updated"
          ? { questUpdatedChannelId: channelId }
          : { questCompletionChannelId: channelId };
    await this.db
      .update(schema.forgeEnabledChannels)
      .set(patch)
      .where(
        and(
          eq(schema.forgeEnabledChannels.discordGuildId, discordGuildId),
          eq(schema.forgeEnabledChannels.discordChannelId, forgeChannelId)
        )
      );
  }

  private pickNonEmpty(
    s: string | null | undefined
  ): string | undefined {
    const t = s?.trim();
    return t ? t : undefined;
  }

  async getQuestAnnouncementRouting(
    discordGuildId: string,
    forgeChannelId: string,
    kind: QuestAnnouncementKind
  ): Promise<QuestAnnouncementRouting | undefined> {
    const rows = await this.db
      .select({
        announcementChannelId:
          schema.forgeEnabledChannels.announcementChannelId,
        questAddedChannelId: schema.forgeEnabledChannels.questAddedChannelId,
        questUpdatedChannelId:
          schema.forgeEnabledChannels.questUpdatedChannelId,
        questCompletionChannelId:
          schema.forgeEnabledChannels.questCompletionChannelId,
      })
      .from(schema.forgeEnabledChannels)
      .where(
        and(
          eq(schema.forgeEnabledChannels.discordGuildId, discordGuildId),
          eq(schema.forgeEnabledChannels.discordChannelId, forgeChannelId)
        )
      )
      .limit(1);
    const r = rows[0];
    if (!r) return undefined;
    const def = this.pickNonEmpty(r.announcementChannelId);
    if (kind === "new") {
      const o = this.pickNonEmpty(r.questAddedChannelId);
      if (o) return { channelId: o, source: "quest_added" };
      if (def) return { channelId: def, source: "default" };
      return undefined;
    }
    if (kind === "update") {
      const o = this.pickNonEmpty(r.questUpdatedChannelId);
      if (o) return { channelId: o, source: "quest_updated" };
      if (def) return { channelId: def, source: "default" };
      return undefined;
    }
    const o = this.pickNonEmpty(r.questCompletionChannelId);
    if (o) return { channelId: o, source: "quest_completion" };
    if (def) return { channelId: def, source: "default" };
    return undefined;
  }

  async clearQuestAnnouncementRouting(
    discordGuildId: string,
    forgeChannelId: string,
    source: QuestAnnouncementRoutingSource
  ): Promise<void> {
    const patch =
      source === "default"
        ? { announcementChannelId: null as null }
        : source === "quest_added"
          ? { questAddedChannelId: null as null }
          : source === "quest_updated"
            ? { questUpdatedChannelId: null as null }
            : { questCompletionChannelId: null as null };
    await this.db
      .update(schema.forgeEnabledChannels)
      .set(patch)
      .where(
        and(
          eq(schema.forgeEnabledChannels.discordGuildId, discordGuildId),
          eq(schema.forgeEnabledChannels.discordChannelId, forgeChannelId)
        )
      );
  }

  async listMonitoredBuildingScopePairs(): Promise<
    MonitoredBuildingScopePair[]
  > {
    const rows = await this.db
      .select({
        discordGuildId: schema.monitoredBuildings.discordGuildId,
        forgeChannelId: schema.monitoredBuildings.forgeChannelId,
        buildingId: schema.monitoredBuildings.buildingId,
      })
      .from(schema.monitoredBuildings);
    return rows;
  }

  async isBuildingMonitored(
    discordGuildId: string,
    forgeChannelId: string,
    buildingId: string
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: schema.monitoredBuildings.id })
      .from(schema.monitoredBuildings)
      .where(
        and(
          eq(schema.monitoredBuildings.discordGuildId, discordGuildId),
          eq(schema.monitoredBuildings.forgeChannelId, forgeChannelId),
          eq(schema.monitoredBuildings.buildingId, buildingId)
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async recordQuestCompletion(
    input: RecordQuestCompletionInput
  ): Promise<AddResult> {
    const {
      discordGuildId,
      forgeChannelId,
      buildingId,
      questEntityId,
      subjectKey,
      offerStacks,
      requireStacks,
      leaderboardPoints,
    } = input;
    await this.ensureGuild(discordGuildId);
    await this.db.insert(schema.questCompletions).values({
      discordGuildId,
      forgeChannelId,
      buildingId,
      questEntityId,
      subjectKey,
      offerStacks,
      requireStacks,
      leaderboardPoints,
    });
    return "ok";
  }

  async getQuestScoringConfig(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<QuestScoringConfigView | null> {
    const rows = await this.db
      .select({
        mode: schema.forgeEnabledChannels.questLeaderboardScoringMode,
        weights: schema.forgeEnabledChannels.questScoringWeights,
      })
      .from(schema.forgeEnabledChannels)
      .where(
        and(
          eq(schema.forgeEnabledChannels.discordGuildId, discordGuildId),
          eq(schema.forgeEnabledChannels.discordChannelId, forgeChannelId)
        )
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      mode: parseQuestLeaderboardScoringMode(row.mode),
      weights: mergeQuestScoringWeights(
        row.weights as Record<string, unknown> | null | undefined
      ),
    };
  }

  async setQuestScoringConfig(
    discordGuildId: string,
    forgeChannelId: string,
    input: {
      mode: QuestLeaderboardScoringMode;
      weightsPatch?: Partial<Record<string, number>> | null;
    },
    getTiers: (itemIds: number[]) => Promise<Map<number, number | null>>
  ): Promise<number> {
    const current = await this.getQuestScoringConfig(
      discordGuildId,
      forgeChannelId
    );
    if (!current) {
      throw new Error(
        `setQuestScoringConfig: forge channel not enabled guild=${discordGuildId} channel=${forgeChannelId}`
      );
    }
    let weights =
      input.mode !== "default" && current.mode === "default"
        ? { ...DEFAULT_QUEST_SCORING_WEIGHTS }
        : { ...current.weights };
    if (input.weightsPatch) {
      for (const [k, v] of Object.entries(input.weightsPatch)) {
        if (typeof v === "number" && Number.isFinite(v)) {
          weights[k] = v;
        }
      }
    }
    weights = mergeQuestScoringWeights(weights);

    await this.db
      .update(schema.forgeEnabledChannels)
      .set({
        questLeaderboardScoringMode: input.mode,
        questScoringWeights: weights,
      })
      .where(
        and(
          eq(schema.forgeEnabledChannels.discordGuildId, discordGuildId),
          eq(schema.forgeEnabledChannels.discordChannelId, forgeChannelId)
        )
      );

    return await this.recalculateQuestCompletionPointsForScope(
      discordGuildId,
      forgeChannelId,
      getTiers
    );
  }

  private async recalculateQuestCompletionPointsForScope(
    discordGuildId: string,
    forgeChannelId: string,
    getTiers: (itemIds: number[]) => Promise<Map<number, number | null>>
  ): Promise<number> {
    const cfg = await this.getQuestScoringConfig(
      discordGuildId,
      forgeChannelId
    );
    if (!cfg) return 0;

    const pageSize = 200;
    let offset = 0;
    let updated = 0;

    for (;;) {
      const rows = await this.db
        .select({
          id: schema.questCompletions.id,
          requireStacks: schema.questCompletions.requireStacks,
        })
        .from(schema.questCompletions)
        .where(
          and(
            eq(schema.questCompletions.discordGuildId, discordGuildId),
            eq(schema.questCompletions.forgeChannelId, forgeChannelId)
          )
        )
        .orderBy(asc(schema.questCompletions.id))
        .limit(pageSize)
        .offset(offset);
      if (rows.length === 0) break;

      const allIds = new Set<number>();
      for (const r of rows) {
        for (const s of parseCompletionStacks(r.requireStacks)) {
          allIds.add(s.itemId);
        }
      }
      const tierByItemId = new Map<number, number | null | undefined>();
      const tierRows = await getTiers([...allIds]);
      for (const id of allIds) {
        if (tierRows.has(id)) tierByItemId.set(id, tierRows.get(id)!);
      }

      for (const r of rows) {
        const stacks = parseCompletionStacks(r.requireStacks);
        const pts = computeLeaderboardPoints({
          mode: cfg.mode,
          requiredStacks: stacks,
          tierByItemId,
          weights: cfg.weights,
        });
        await this.db
          .update(schema.questCompletions)
          .set({ leaderboardPoints: pts })
          .where(eq(schema.questCompletions.id, r.id));
        updated += 1;
      }
      offset += pageSize;
    }

    return updated;
  }

  async questLeaderboard(
    discordGuildId: string,
    forgeChannelId: string,
    limit: number
  ): Promise<QuestLeaderboardRow[]> {
    const pointsSum = sum(schema.questCompletions.leaderboardPoints);
    const rows = await this.db
      .select({
        subjectKey: schema.questCompletions.subjectKey,
        pointsSum,
      })
      .from(schema.questCompletions)
      .where(
        and(
          eq(schema.questCompletions.discordGuildId, discordGuildId),
          eq(schema.questCompletions.forgeChannelId, forgeChannelId)
        )
      )
      .groupBy(schema.questCompletions.subjectKey)
      .orderBy(desc(pointsSum))
      .limit(limit);
    return rows.map((r) => ({
      subjectKey: r.subjectKey,
      points: Number(r.pointsSum ?? 0),
    }));
  }

  async clearQuestCompletionsForScope(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<number> {
    const deleted = await this.db
      .delete(schema.questCompletions)
      .where(
        and(
          eq(schema.questCompletions.discordGuildId, discordGuildId),
          eq(schema.questCompletions.forgeChannelId, forgeChannelId)
        )
      )
      .returning({ id: schema.questCompletions.id });
    return deleted.length;
  }
}
