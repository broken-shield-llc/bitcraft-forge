import { and, count, desc, eq } from "drizzle-orm";
import {
  type BuildingKind,
  normalizeStoredBuildingKind,
} from "@forge/domain";
import {
  type ForgeDb,
  isPgUniqueViolation,
  schema,
} from "@forge/db";
import type {
  AddResult,
  GuildConfigRepository,
  MonitoredBuildingGuildPair,
  MonitoredBuildingRow,
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

  async addClaim(
    discordGuildId: string,
    claimId: string
  ): Promise<AddResult> {
    await this.ensureGuild(discordGuildId);
    try {
      await this.db.insert(schema.monitoredClaims).values({
        discordGuildId,
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
    claimId: string
  ): Promise<boolean> {
    const deleted = await this.db
      .delete(schema.monitoredClaims)
      .where(
        and(
          eq(schema.monitoredClaims.discordGuildId, discordGuildId),
          eq(schema.monitoredClaims.claimId, claimId)
        )
      )
      .returning({ id: schema.monitoredClaims.id });
    return deleted.length > 0;
  }

  async listClaims(discordGuildId: string): Promise<string[]> {
    const rows = await this.db
      .select({ claimId: schema.monitoredClaims.claimId })
      .from(schema.monitoredClaims)
      .where(eq(schema.monitoredClaims.discordGuildId, discordGuildId));
    return [...new Set(rows.map((r) => r.claimId))].sort();
  }

  async addBuilding(
    discordGuildId: string,
    buildingId: string,
    kind: BuildingKind,
    claimId?: string
  ): Promise<AddResult> {
    await this.ensureGuild(discordGuildId);
    try {
      await this.db.insert(schema.monitoredBuildings).values({
        discordGuildId,
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
    buildingId: string
  ): Promise<boolean> {
    const deleted = await this.db
      .delete(schema.monitoredBuildings)
      .where(
        and(
          eq(schema.monitoredBuildings.discordGuildId, discordGuildId),
          eq(schema.monitoredBuildings.buildingId, buildingId)
        )
      )
      .returning({ id: schema.monitoredBuildings.id });
    return deleted.length > 0;
  }

  async listBuildings(
    discordGuildId: string
  ): Promise<MonitoredBuildingRow[]> {
    const rows = await this.db
      .select({
        buildingId: schema.monitoredBuildings.buildingId,
        kind: schema.monitoredBuildings.kind,
        claimId: schema.monitoredBuildings.claimId,
      })
      .from(schema.monitoredBuildings)
      .where(eq(schema.monitoredBuildings.discordGuildId, discordGuildId));

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
    channelId: string | null
  ): Promise<void> {
    await this.ensureGuild(discordGuildId);
    await this.db
      .update(schema.discordGuilds)
      .set({ announcementChannelId: channelId })
      .where(eq(schema.discordGuilds.discordGuildId, discordGuildId));
  }

  async getAnnouncementChannel(
    discordGuildId: string
  ): Promise<string | undefined> {
    const rows = await this.db
      .select({
        announcementChannelId: schema.discordGuilds.announcementChannelId,
      })
      .from(schema.discordGuilds)
      .where(eq(schema.discordGuilds.discordGuildId, discordGuildId))
      .limit(1);
    const id = rows[0]?.announcementChannelId;
    return id ?? undefined;
  }

  async listMonitoredBuildingGuildPairs(): Promise<MonitoredBuildingGuildPair[]> {
    const rows = await this.db
      .select({
        discordGuildId: schema.monitoredBuildings.discordGuildId,
        buildingId: schema.monitoredBuildings.buildingId,
      })
      .from(schema.monitoredBuildings);
    return rows;
  }

  async isBuildingMonitored(
    discordGuildId: string,
    buildingId: string
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: schema.monitoredBuildings.id })
      .from(schema.monitoredBuildings)
      .where(
        and(
          eq(schema.monitoredBuildings.discordGuildId, discordGuildId),
          eq(schema.monitoredBuildings.buildingId, buildingId)
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async recordQuestCompletion(
    discordGuildId: string,
    buildingId: string,
    questEntityId: string,
    subjectKey: string
  ): Promise<AddResult> {
    await this.ensureGuild(discordGuildId);
    try {
      await this.db.insert(schema.questCompletions).values({
        discordGuildId,
        buildingId,
        questEntityId,
        subjectKey,
      });
      return "ok";
    } catch (e: unknown) {
      if (isPgUniqueViolation(e)) return "duplicate";
      throw e;
    }
  }

  async questLeaderboard(
    discordGuildId: string,
    limit: number
  ): Promise<QuestLeaderboardRow[]> {
    const rows = await this.db
      .select({
        subjectKey: schema.questCompletions.subjectKey,
        completions: count(),
      })
      .from(schema.questCompletions)
      .where(eq(schema.questCompletions.discordGuildId, discordGuildId))
      .groupBy(schema.questCompletions.subjectKey)
      .orderBy(desc(count()))
      .limit(limit);
    return rows.map((r) => ({
      subjectKey: r.subjectKey,
      completions: Number(r.completions),
    }));
  }
}
