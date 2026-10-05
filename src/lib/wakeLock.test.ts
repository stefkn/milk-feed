import { describe, expect, it, vi } from "vitest";
import { createScreenWakeLock, type ScreenLock } from "./wakeLock";

function lock() {
  let released = () => {};
  return {
    release: vi.fn(async () => {
      released();
    }),
    addEventListener: vi.fn((_type: string, listener: () => void) => {
      released = listener;
    }),
  };
}

describe("screen wake lock", () => {
  it("handles missing API and denied requests", async () => {
    const changed = vi.fn();
    await createScreenWakeLock(undefined, () => true, changed).request();
    await createScreenWakeLock(
      { request: vi.fn().mockRejectedValue(new Error("denied")) },
      () => true,
      changed,
    ).request();
    expect(changed).not.toHaveBeenCalled();
  });
  it("prevents duplicate locks, clears held state on platform release, and reacquires", async () => {
    const acquired = lock();
    const api = { request: vi.fn(async () => acquired) };
    const changed = vi.fn();
    const controller = createScreenWakeLock(api, () => true, changed);
    await controller.request();
    await controller.request();
    expect(api.request).toHaveBeenCalledTimes(1);
    await acquired.release();
    expect(changed).toHaveBeenLastCalledWith(false);
    await controller.request();
    expect(api.request).toHaveBeenCalledTimes(2);
    await controller.release();
    expect(changed).toHaveBeenLastCalledWith(false);
  });
  it("releases a pending request that completes after pause or destruction", async () => {
    let resolve!: (value: ScreenLock) => void;
    const api = {
      request: vi.fn(
        () =>
          new Promise<ScreenLock>((done) => {
            resolve = done;
          }),
      ),
    };
    let feeding = true;
    const changed = vi.fn();
    const controller = createScreenWakeLock(api, () => feeding, changed);
    const pending = controller.request();
    feeding = false;
    await controller.release();
    const acquired = lock();
    resolve(acquired);
    await pending;
    expect(acquired.release).toHaveBeenCalledTimes(1);
    expect(changed).not.toHaveBeenCalledWith(true);
  });
});
