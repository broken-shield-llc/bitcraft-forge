/** First retry after disconnect (ms). */
export const STDB_RECONNECT_INITIAL_MS = 5_000;
/** Cap between attempts so we do not hammer the host (ms). */
export const STDB_RECONNECT_MAX_MS = 5 * 60_000;
/** Extra random delay per attempt to spread reconnects (ms). */
export const STDB_RECONNECT_JITTER_MS = 2_500;

/**
 * Exponential backoff with jitter: `min(max, initial * 2^attempt) + random(0, jitter)`.
 * `attempt` is 0 on first schedule after a successful session.
 */
export function reconnectDelayMs(attempt: number): number {
  const cappedPow = Math.min(attempt, 16);
  const exp = Math.min(
    STDB_RECONNECT_MAX_MS,
    STDB_RECONNECT_INITIAL_MS * 2 ** cappedPow
  );
  return exp + Math.floor(Math.random() * STDB_RECONNECT_JITTER_MS);
}
