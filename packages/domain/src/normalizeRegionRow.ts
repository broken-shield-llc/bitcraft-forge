/** Phase 0: normalize a row-shaped object for logging / display (stub until bound to real types). */

export type RegionConnectionInfoDto = {
  id: number;
  label: string;
};

export function normalizeRegionConnectionInfoStub(
  raw: Record<string, unknown>
): RegionConnectionInfoDto | null {
  const id = raw.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  const label =
    typeof raw.label === "string"
      ? raw.label
      : typeof raw.name === "string"
        ? raw.name
        : `region-${id}`;
  return { id, label };
}
