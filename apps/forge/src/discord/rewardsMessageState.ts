/**
 * Ephemeral Stall rewards picker/detail state keyed by Discord message id
 * (`custom_id` cannot carry stall ids or paging session data).
 */

export type RewardsMessageDetailState = {
  listPage: number;
  scopeRaw: string;
  detailPageIdx: number;
  updatedAtMs: number;
};

const TTL_MS = 2 * 60 * 60 * 1000;
const rewardsListOnlyPage = new Map<string, number>();
const rewardsDetailByMessageId = new Map<string, RewardsMessageDetailState>();

function pruneDetailIfStale(messageId: string): void {
  const s = rewardsDetailByMessageId.get(messageId);
  if (s && Date.now() - s.updatedAtMs > TTL_MS) {
    rewardsDetailByMessageId.delete(messageId);
  }
}

export function setRewardsListPage(messageId: string, listPage: number): void {
  rewardsListOnlyPage.set(messageId, listPage);
}

export function getRewardsListPage(messageId: string): number {
  return rewardsListOnlyPage.get(messageId) ?? 0;
}

export function setRewardsDetailState(
  messageId: string,
  state: Omit<RewardsMessageDetailState, "updatedAtMs">
): void {
  rewardsDetailByMessageId.set(messageId, {
    ...state,
    updatedAtMs: Date.now(),
  });
}

export function getRewardsDetailState(
  messageId: string
): RewardsMessageDetailState | undefined {
  pruneDetailIfStale(messageId);
  return rewardsDetailByMessageId.get(messageId);
}

export function clearRewardsDetailState(messageId: string): void {
  rewardsDetailByMessageId.delete(messageId);
}

export function clearRewardsInteractiveState(messageId: string): void {
  rewardsListOnlyPage.delete(messageId);
  rewardsDetailByMessageId.delete(messageId);
}
