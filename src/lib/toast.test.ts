import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { clearToasts, dismissToast, pushToast, toasts } from "./toast";

describe("toasts", () => {
  afterEach(() => {
    clearToasts();
    vi.useRealTimers();
  });
  it("expires independently and allows dismissing one toast", () => {
    vi.useFakeTimers();
    const first = pushToast("one", { durationMs: 100 });
    pushToast("two", { durationMs: 200 });
    dismissToast(first);
    expect(get(toasts).map((t) => t.message)).toEqual(["two"]);
    vi.advanceTimersByTime(200);
    expect(get(toasts)).toEqual([]);
  });
});
