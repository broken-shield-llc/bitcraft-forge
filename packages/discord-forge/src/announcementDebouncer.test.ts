import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createKeyedDebouncer } from "./announcementDebouncer.js";

describe("createKeyedDebouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces multiple schedules for the same key to the last callback", async () => {
    const runs: string[] = [];
    const deb = createKeyedDebouncer(100);
    deb("guild:quest", () => {
      runs.push("first");
    });
    deb("guild:quest", () => {
      runs.push("second");
    });
    expect(runs).toEqual([]);
    await vi.advanceTimersByTimeAsync(100);
    expect(runs).toEqual(["second"]);
  });

  it("uses separate timers per key", async () => {
    const runs: string[] = [];
    const deb = createKeyedDebouncer(50);
    deb("a", () => {
      runs.push("a");
    });
    deb("b", () => {
      runs.push("b");
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(runs.sort()).toEqual(["a", "b"]);
  });

  it("does not run before the delay elapses", async () => {
    let n = 0;
    const deb = createKeyedDebouncer(200);
    deb("k", () => {
      n += 1;
    });
    await vi.advanceTimersByTimeAsync(199);
    expect(n).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(n).toBe(1);
  });

  it("does not propagate rejection from async callback", async () => {
    const deb = createKeyedDebouncer(10);
    deb("k", async () => {
      throw new Error("ignored");
    });
    await vi.advanceTimersByTimeAsync(10);
  });
});
