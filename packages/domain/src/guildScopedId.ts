const MAX_LEN = 128;

/** Normalize user-supplied claim/building ids from slash commands. */
export function normalizeScopedId(raw: string): string | null {
  const s = raw.trim();
  if (!s || s.length > MAX_LEN) return null;
  return s;
}
