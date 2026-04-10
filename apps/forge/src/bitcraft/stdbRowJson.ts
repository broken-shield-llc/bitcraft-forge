export function stdbRowToJson(row: unknown): Record<string, unknown> {
  const s = JSON.stringify(row, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
  return JSON.parse(s) as Record<string, unknown>;
}
