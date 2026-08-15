import { describe, it, expect } from "vitest";
import {
  nextFeedDueMs,
  DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings,
} from "./reminders";
import type { FeedLog } from "./types";

function makeFeed(overrides: Partial<FeedLog> = {}): FeedLog {
  return {
    feedId: "1",
    start: new Date(),
    end: new Date(),
    duration: 0,
    bottleSize: 0,
    remainingMilk: 0,
    type: "bottle",
    ...overrides,
  };
}

function settings(overrides: Partial<ReminderSettings> = {}): ReminderSettings {
  return { ...DEFAULT_REMINDER_SETTINGS, ...overrides };
}

describe("nextFeedDueMs", () => {
  it("returns undefined when there are no feeds", () => {
    expect(nextFeedDueMs([], settings({ mode: "auto" }))).toBeUndefined();
    expect(nextFeedDueMs([], settings({ mode: "fixed" }))).toBeUndefined();
  });

  it("uses the fixed interval after the last feed start", () => {
    const feeds = [
      makeFeed({ start: new Date("2024-01-01T00:00:00") }),
      makeFeed({ start: new Date("2024-01-01T03:00:00") }),
    ];
    const now = new Date("2024-01-01T04:00:00").getTime();
    const due = nextFeedDueMs(
      feeds,
      settings({ mode: "fixed", fixedIntervalHours: 3 }),
      now,
    );
    expect(due).toBe(new Date("2024-01-01T06:00:00").getTime());
  });

  it("returns undefined for an invalid fixed interval", () => {
    const feeds = [makeFeed({ start: new Date("2024-01-01T03:00:00") })];
    expect(
      nextFeedDueMs(feeds, settings({ mode: "fixed", fixedIntervalHours: 0 })),
    ).toBeUndefined();
    expect(
      nextFeedDueMs(
        feeds,
        settings({ mode: "fixed", fixedIntervalHours: Number.NaN }),
      ),
    ).toBeUndefined();
  });

  it("uses the estimated schedule in auto mode", () => {
    const feeds = [
      makeFeed({ start: new Date("2024-01-01T00:00:00") }),
      makeFeed({ start: new Date("2024-01-01T03:00:00") }),
    ];
    const now = new Date("2024-01-01T04:00:00").getTime();
    const due = nextFeedDueMs(feeds, settings({ mode: "auto" }), now);
    expect(due).toBe(new Date("2024-01-01T06:00:00").getTime());
  });

  it("returns undefined in auto mode with insufficient history", () => {
    const feeds = [makeFeed({ start: new Date("2024-01-01T03:00:00") })];
    expect(
      nextFeedDueMs(feeds, settings({ mode: "auto" })),
    ).toBeUndefined();
  });
});
