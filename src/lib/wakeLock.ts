export type ScreenLock = {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
};
export type ScreenLockAPI = { request(type: "screen"): Promise<ScreenLock> };

// A request may resolve after pause, stop, or unmount. Release that stale lock.
export function createScreenWakeLock(
  api: ScreenLockAPI | undefined,
  shouldHold: () => boolean,
  onChange: (held: boolean) => void,
) {
  let lock: ScreenLock | undefined;
  let pending = false;
  let generation = 0;

  async function request(): Promise<void> {
    if (!api || !shouldHold() || lock || pending) return;
    pending = true;
    const requestedGeneration = generation;
    try {
      const acquired = await api.request("screen");
      if (requestedGeneration !== generation || !shouldHold()) {
        await acquired.release();
        return;
      }
      lock = acquired;
      onChange(true);
      acquired.addEventListener("release", () => {
        if (lock === acquired) {
          lock = undefined;
          onChange(false);
        }
      });
    } catch {
      // Unsupported policies, low battery, and denied requests are normal.
    } finally {
      pending = false;
      if (requestedGeneration !== generation && shouldHold()) void request();
    }
  }

  async function release(): Promise<void> {
    generation++;
    const acquired = lock;
    lock = undefined;
    onChange(false);
    try {
      await acquired?.release();
    } catch {
      /* already released */
    }
  }

  return { request, release };
}
