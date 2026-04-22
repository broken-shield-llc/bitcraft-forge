/**
 * In-memory state for quest board **shop detail** so Prev/Next buttons can stay
 * under Discord's 100-char `custom_id` limit (a shop entity id can be 100 chars).
 */
export type QuestBoardDetailMessageState = {
  shopEntityIdStr: string;
  offerPage: number;
  totalOfferPages: number;
  updatedAtMs: number;
};

const TTL_MS = 2 * 60 * 60 * 1000; // 2h

const byMessageId = new Map<string, QuestBoardDetailMessageState>();

function pruneIfStale(id: string): void {
  const s = byMessageId.get(id);
  if (s && Date.now() - s.updatedAtMs > TTL_MS) {
    byMessageId.delete(id);
  }
}

export function setQuestBoardDetailState(
  messageId: string,
  state: Omit<QuestBoardDetailMessageState, "updatedAtMs">
): void {
  byMessageId.set(messageId, { ...state, updatedAtMs: Date.now() });
}

export function getQuestBoardDetailState(
  messageId: string
): QuestBoardDetailMessageState | undefined {
  pruneIfStale(messageId);
  return byMessageId.get(messageId);
}

export function clearQuestBoardDetailState(messageId: string): void {
  byMessageId.delete(messageId);
}
