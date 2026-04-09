import { describe, expect, it, vi } from "vitest";
import type { ForgeDb } from "@forge/db";
import { DrizzleGuildConfigRepository } from "./drizzleGuildConfigRepository.js";

function drizzleUniqueViolationError(): Error {
  const cause = Object.assign(new Error("duplicate key"), {
    code: "23505",
  });
  return Object.assign(new Error("Failed query: insert …"), { cause });
}

/**
 * Minimal `ForgeDb` mock: `ensureGuild` does one insert chain; `addBuilding` does a second insert that can reject.
 */
function createMockDbForAddBuilding(
  secondInsertResult: "ok" | "unique_violation"
): ForgeDb {
  let insertCall = 0;
  return {
    insert: vi.fn(() => {
      insertCall += 1;
      if (insertCall === 1) {
        return {
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        };
      }
      return {
        values: vi.fn(() => {
          if (secondInsertResult === "unique_violation") {
            return Promise.reject(drizzleUniqueViolationError());
          }
          return Promise.resolve(undefined);
        }),
      };
    }),
  } as unknown as ForgeDb;
}

/**
 * `recordQuestCompletion`: first insert is `ensureGuild` (onConflictDoNothing),
 * second is `quest_completions` (always inserts; no duplicate short-circuit after migration 0013).
 */
function createMockDbForRecordQuestCompletion(): ForgeDb {
  let insertCall = 0;
  return {
    insert: vi.fn(() => {
      insertCall += 1;
      if (insertCall % 2 === 1) {
        return {
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        };
      }
      return {
        values: vi.fn().mockResolvedValue(undefined),
      };
    }),
  } as unknown as ForgeDb;
}

describe("DrizzleGuildConfigRepository.recordQuestCompletion", () => {
  it("returns ok after ensureGuild + quest completion insert (no duplicate handling)", async () => {
    const db = createMockDbForRecordQuestCompletion();
    const repo = new DrizzleGuildConfigRepository(db);
    const r = await repo.recordQuestCompletion(
      "guild1",
      "forge-ch",
      "building99",
      "quest42",
      "s:deadbeef"
    );
    expect(r).toBe("ok");
  });

  it("allows repeated identical keys (second completion still ok)", async () => {
    const db = createMockDbForRecordQuestCompletion();
    const repo = new DrizzleGuildConfigRepository(db);
    const args = [
      "guild1",
      "forge-ch",
      "b1",
      "q1",
      "s:same",
    ] as const;
    expect(await repo.recordQuestCompletion(...args)).toBe("ok");
    expect(await repo.recordQuestCompletion(...args)).toBe("ok");
  });
});

describe("DrizzleGuildConfigRepository.addBuilding", () => {
  it("returns duplicate when insert fails with unique violation (Drizzle-wrapped)", async () => {
    const repo = new DrizzleGuildConfigRepository(
      createMockDbForAddBuilding("unique_violation")
    );
    const r = await repo.addBuilding(
      "guild1",
      "forge-ch",
      "building42",
      "stall"
    );
    expect(r).toBe("duplicate");
  });

  it("returns ok when second insert succeeds", async () => {
    const repo = new DrizzleGuildConfigRepository(
      createMockDbForAddBuilding("ok")
    );
    const r = await repo.addBuilding(
      "guild1",
      "forge-ch",
      "building42",
      "counter"
    );
    expect(r).toBe("ok");
  });
});
