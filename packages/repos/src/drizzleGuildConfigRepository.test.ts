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
