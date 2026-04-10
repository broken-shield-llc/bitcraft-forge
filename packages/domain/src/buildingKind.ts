export type BuildingKind = "stall" | "counter";

const LABEL: Record<BuildingKind, string> = {
  stall: "Barter Stall",
  counter: "Barter Counter",
};

export function formatBuildingKind(kind: BuildingKind): string {
  return LABEL[kind];
}

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

/**
 * Infer Barter Stall vs Counter from `building_desc.name` (cached from SpacetimeDB).
 * Returns null when the name does not clearly identify a barter building type.
 */
export function inferBuildingKindFromDescName(name: string): BuildingKind | null {
  const s = name.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("counter")) return "counter";
  if (s.includes("stall")) return "stall";
  if (/\bstand\b/.test(s)) return "counter";
  return null;
}
