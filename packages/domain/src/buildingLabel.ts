/**
 * Display label for a BitCraft building id: prefer player nickname; keep entity id visible.
 * Uses Discord markdown (bold, backticks).
 */
export function formatBuildingDisplayLabel(
  buildingEntityId: string,
  nickname: string | undefined | null
): string {
  const n = nickname?.trim();
  if (n) return `**${n}** (\`${buildingEntityId}\`)`;
  return `\`${buildingEntityId}\``;
}
