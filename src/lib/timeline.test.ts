import { describe, it, expect } from "vitest";
import {
  defaultTimelineRange,
  nightPeriodsInRange,
  dayPeriodsInRange,
  clampRangeToMax,
  MAX_TIMELINE_RANGE_MS,
  DEFAULT_NIGHT_START_HOUR,
  DEFAULT_NIGHT_END_HOUR,
} from "./timeline";
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

describe("defaultTimelineRange", () => {
  it("shows the last three hours when there are no feeds", () => {
    const now = new Date("2024-01-01T12:00:00").getTime();
    const range = defaultTimelineRange([], now);
    expect(range.max).toBe(now);
    expect(range.min).toBe(now - 3 * 60 * 60 * 1000);
  });

  it("pads a single short feed so it is not a sliver", () => {
    const now = new Date("2024-01-01T12:00:00").getTime();
    const start = new Date("2024-01-01T11:50:00");
    const end = new Date("2024-01-01T12:00:00");
    const feeds = [makeFeed({ start, end })];

    const range = defaultTimelineRange(feeds, now);
    expect(range.min).toBe(start.getTime() - 30 * 60 * 1000);
    expect(range.max).toBe(now + 5 * 60 * 1000);
  });

  it("uses the actual feed timestamps rather than midnight", () => {
    const now = new Date("2024-01-01T12:00:00").getTime();
    const feeds = [
      makeFeed({
        start: new Date("2024-01-01T10:00:00"),
        end: new Date("2024-01-01T10:10:00"),
      }),
    ];
    const range = defaultTimelineRange(feeds, now);
    // The feed is at 10:00, so the left bound is well after midnight.
    expect(range.min).toBeGreaterThan(new Date("2024-01-01T00:00:00").getTime());
  });
});

describe("nightPeriodsInRange", () => {
  it("returns a single night for a range spanning one night", () => {
    const min = new Date("2024-01-01T18:00:00").getTime();
    const max = new Date("2024-01-02T08:00:00").getTime();
    const periods = nightPeriodsInRange(min, max);
    expect(periods).toEqual([
      [
        new Date("2024-01-01T20:00:00").getTime(),
        new Date("2024-01-02T06:00:00").getTime(),
      ],
    ]);
  });

  it("returns multiple nights for a multi-day range", () => {
    const min = new Date("2024-01-01T00:00:00").getTime();
    const max = new Date("2024-01-03T00:00:00").getTime();
    const periods = nightPeriodsInRange(min, max);
    expect(periods).toHaveLength(3);
    expect(periods[0][0]).toBe(new Date("2024-01-01T00:00:00").getTime());
    expect(periods[1][0]).toBe(new Date("2024-01-01T20:00:00").getTime());
    expect(periods[2][0]).toBe(new Date("2024-01-02T20:00:00").getTime());
  });

  it("includes the early-morning tail of the previous night", () => {
    const min = new Date("2024-01-02T02:00:00").getTime();
    const max = new Date("2024-01-02T08:00:00").getTime();
    const periods = nightPeriodsInRange(min, max);
    expect(periods).toEqual([
      [
        new Date("2024-01-02T02:00:00").getTime(),
        new Date("2024-01-02T06:00:00").getTime(),
      ],
    ]);
  });

  it("clamps nights to the requested range", () => {
    const min = new Date("2024-01-01T22:00:00").getTime();
    const max = new Date("2024-01-02T04:00:00").getTime();
    const periods = nightPeriodsInRange(min, max);
    expect(periods).toEqual([[min, max]]);
  });

  it("returns no periods when the range is entirely during the day", () => {
    const min = new Date("2024-01-01T08:00:00").getTime();
    const max = new Date("2024-01-01T18:00:00").getTime();
    expect(nightPeriodsInRange(min, max)).toEqual([]);
  });

  it("uses the configured night hours", () => {
    const min = new Date("2024-01-01T06:00:00").getTime();
    const max = new Date("2024-01-02T12:00:00").getTime();
    const periods = nightPeriodsInRange(min, max, 21, 5);
    expect(periods).toEqual([
      [
        new Date("2024-01-01T21:00:00").getTime(),
        new Date("2024-01-02T05:00:00").getTime(),
      ],
    ]);
  });

  it("exposes default night hours", () => {
    expect(DEFAULT_NIGHT_START_HOUR).toBe(20);
    expect(DEFAULT_NIGHT_END_HOUR).toBe(6);
  });
});

describe("dayPeriodsInRange", () => {
  it("returns the day period for a single day", () => {
    const min = new Date("2024-01-01T00:00:00").getTime();
    const max = new Date("2024-01-02T00:00:00").getTime();
    expect(dayPeriodsInRange(min, max)).toEqual([
      [
        new Date("2024-01-01T06:00:00").getTime(),
        new Date("2024-01-01T20:00:00").getTime(),
      ],
    ]);
  });

  it("returns multiple day periods across days", () => {
    const min = new Date("2024-01-01T00:00:00").getTime();
    const max = new Date("2024-01-03T00:00:00").getTime();
    const periods = dayPeriodsInRange(min, max);
    expect(periods).toHaveLength(2);
    expect(periods[0][0]).toBe(new Date("2024-01-01T06:00:00").getTime());
    expect(periods[1][0]).toBe(new Date("2024-01-02T06:00:00").getTime());
  });

  it("returns no periods during the night", () => {
    const min = new Date("2024-01-01T22:00:00").getTime();
    const max = new Date("2024-01-02T02:00:00").getTime();
    expect(dayPeriodsInRange(min, max)).toEqual([]);
  });

  it("clamps the day to the requested range", () => {
    const min = new Date("2024-01-01T08:00:00").getTime();
    const max = new Date("2024-01-01T10:00:00").getTime();
    expect(dayPeriodsInRange(min, max)).toEqual([[min, max]]);
  });
});

describe("clampRangeToMax", () => {
  it("leaves a range within the limit unchanged", () => {
    const min = new Date("2024-01-01T00:00:00").getTime();
    const max = new Date("2024-01-03T00:00:00").getTime();
    expect(clampRangeToMax(min, max, 5 * 24 * 60 * 60 * 1000)).toEqual({
      min,
      max,
    });
  });

  it("clamps an oversized range to the limit, keeping the center", () => {
    const min = new Date("2024-01-01T00:00:00").getTime();
    const max = new Date("2024-01-10T00:00:00").getTime();
    const clamped = clampRangeToMax(min, max, 5 * 24 * 60 * 60 * 1000);
    const center = (min + max) / 2;
    const half = (5 * 24 * 60 * 60 * 1000) / 2;
    expect(clamped).toEqual({ min: center - half, max: center + half });
  });

  it("exposes a five-day default limit", () => {
    expect(MAX_TIMELINE_RANGE_MS).toBe(5 * 24 * 60 * 60 * 1000);
  });
});
