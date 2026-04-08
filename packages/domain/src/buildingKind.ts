/** Stored slug for BitCraft barter building types (DB + slash choice `value`). */
export type BuildingKind = "stall" | "counter";

const LABEL: Record<BuildingKind, string> = {
  stall: "Barter Stall",
  counter: "Barter Counter",
};

export function formatBuildingKind(kind: BuildingKind): string {
  return LABEL[kind];
}

/** Normalize values read from the database (legacy `stand` → `counter`). */
export function normalizeStoredBuildingKind(raw: string): BuildingKind {
  const s = raw.trim().toLowerCase();
  if (s === "stall") return "stall";
  if (s === "counter" || s === "stand") return "counter";
  return "stall";
}

export function parseBuildingKind(raw: string | null): BuildingKind | null {
  const s = raw?.trim().toLowerCase();
  if (s === "stall" || s === "counter") return s;
  return null;
}
