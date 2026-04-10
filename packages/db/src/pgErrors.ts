/**
 * True when `e` is (or wraps) a Postgres unique-violation (SQLSTATE 23505).
 * Drizzle often surfaces failures as `DrizzleQueryError` with the driver error on `cause`.
 */
export function isPgUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  while (cur !== null && cur !== undefined && typeof cur === "object") {
    const o = cur as { code?: unknown; cause?: unknown };
    if (o.code === "23505") return true;
    cur = o.cause;
  }
  return false;
}

export function isPgDuplicateRelation(e: unknown): boolean {
  let cur: unknown = e;
  while (cur !== null && cur !== undefined && typeof cur === "object") {
    const o = cur as { code?: unknown; cause?: unknown };
    if (o.code === "42P07") return true;
    cur = o.cause;
  }
  return false;
}
