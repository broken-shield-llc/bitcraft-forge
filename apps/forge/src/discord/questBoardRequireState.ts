/**
 * In-memory: which quest board **message** was opened with the **quest search** subcommand
 * so list/detail buttons can pass the same `requireQuery` to application code.
 */
const TTL_MS = 2 * 60 * 60 * 1000;

type Row = { requireQuery: string; updatedAtMs: number };

const byMessageId = new Map<string, Row>();

function pruneIfStale(id: string): void {
  const s = byMessageId.get(id);
  if (s && Date.now() - s.updatedAtMs > TTL_MS) {
    byMessageId.delete(id);
  }
}

/**
 * `null` clears the key (unfiltered list, e.g. after **quest board** without a search query).
 */
export function setQuestBoardListRequireQuery(
  messageId: string,
  requireQuery: string | null
): void {
  if (requireQuery === null || requireQuery.trim() === "") {
    byMessageId.delete(messageId);
    return;
  }
  byMessageId.set(messageId, {
    requireQuery: requireQuery.trim(),
    updatedAtMs: Date.now(),
  });
}

/**
 * `undefined` if never set or expired — treat as unfiltered. Otherwise the active search string.
 */
export function getQuestBoardListRequireQuery(
  messageId: string
): string | undefined {
  pruneIfStale(messageId);
  return byMessageId.get(messageId)?.requireQuery;
}

export function clearQuestBoardListRequireQuery(messageId: string): void {
  byMessageId.delete(messageId);
}
