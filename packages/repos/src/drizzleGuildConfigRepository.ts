import { and, count, desc, eq } from "drizzle-orm";
import {
  type BuildingKind,
  normalizeStoredBuildingKind,
} from "@forge/domain";
import { type ForgeDb, isPgUniqueViolation, schema } from "@forge/db";
import type {
  AddResult,
  GuildConfigRepository,
  MonitoredBuildingRow,
  MonitoredBuildingScopePair,
  QuestLeaderboardRow,
} from "./guildConfigRepository.js";

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

  async getAnnouncementChannel(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<string | undefined> {
    const rows = await this.db
      .select({
        announcementChannelId:
          schema.forgeEnabledChannels.announcementChannelId,
      })
      .from(schema.forgeEnabledChannels)
      .where(
        and(
          eq(schema.forgeEnabledChannels.discordGuildId, discordGuildId),
          eq(schema.forgeEnabledChannels.discordChannelId, forgeChannelId)
        )
      )
      .limit(1);
    const id = rows[0]?.announcementChannelId;
    return id ?? undefined;
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
    discordGuildId: string,
    forgeChannelId: string,
    buildingId: string,
    questEntityId: string,
    subjectKey: string
  ): Promise<AddResult> {
    await this.ensureGuild(discordGuildId);
    await this.db.insert(schema.questCompletions).values({
      discordGuildId,
      forgeChannelId,
      buildingId,
      questEntityId,
      subjectKey,
    });
    return "ok";
  }

  async questLeaderboard(
    discordGuildId: string,
    forgeChannelId: string,
    limit: number
  ): Promise<QuestLeaderboardRow[]> {
    const rows = await this.db
      .select({
        subjectKey: schema.questCompletions.subjectKey,
        completions: count(),
      })
      .from(schema.questCompletions)
      .where(
        and(
          eq(schema.questCompletions.discordGuildId, discordGuildId),
          eq(schema.questCompletions.forgeChannelId, forgeChannelId)
        )
      )
      .groupBy(schema.questCompletions.subjectKey)
      .orderBy(desc(count()))
      .limit(limit);
    return rows.map((r) => ({
      subjectKey: r.subjectKey,
      completions: Number(r.completions),
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
