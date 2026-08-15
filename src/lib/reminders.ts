import type { FeedLog } from "./types";
import { timeUntilNextFeed } from "./feed";

export type ReminderMode = "auto" | "fixed";

export interface ReminderSettings {
  enabled: boolean;
  mode: ReminderMode;
  fixedIntervalHours: number;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  mode: "auto",
  fixedIntervalHours: 3,
};

export function nextFeedDueMs(
  feeds: FeedLog[],
  settings: ReminderSettings,
  nowMs: number = Date.now(),
): number | undefined {
  if (feeds.length === 0) {
    return undefined;
  }

  const lastStart = Math.max(
    ...feeds.map((feed) => new Date(feed.start).getTime()),
  );

  if (settings.mode === "fixed") {
    const hours = Number(settings.fixedIntervalHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      return undefined;
    }
    return lastStart + hours * 60 * 60 * 1000;
  }

  const seconds = timeUntilNextFeed(feeds, nowMs);
  if (seconds === undefined) {
    return undefined;
  }
  return nowMs + seconds * 1000;
}
