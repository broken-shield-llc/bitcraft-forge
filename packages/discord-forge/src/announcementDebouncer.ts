export type DebouncedFn = () => void | Promise<void>;

/**
 * Coalesces rapid updates per logical key (e.g. Discord guild + quest key).
 */
export function createKeyedDebouncer(ms: number) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return function schedule(key: string, run: DebouncedFn): void {
    const prev = timers.get(key);
    if (prev !== undefined) clearTimeout(prev);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void Promise.resolve(run()).catch(() => {
          /* caller logs */
        });
      }, ms)
    );
  };
}
