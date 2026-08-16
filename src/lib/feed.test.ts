import { describe, it, expect } from "vitest";
import {
  milkConsumed,
  totalMilk,
  totalDuration,
  formatDuration,
  sortFeedsByStart,
  applyFeedEdit,
  feedElapsedMs,
  feedElapsedSeconds,
  generateFeedId,
  feedsOnDate,
  timeSinceLastFeed,
  formatTimeSince,
  DEFAULT_ML_PER_MINUTE,
  feedsSpanMultipleDays,
  medianFeedInterval,
  timeUntilNextFeed,
  formatTimeUntil,
} from "./feed";
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

describe("milkConsumed", () => {
  it("returns full bottle size when no milk remains", () => {
    const feed = makeFeed({ bottleSize: 120, remainingMilk: 0 });
    expect(milkConsumed(feed)).toBe(120);
  });

  it("subtracts remaining milk from bottle size", () => {
    const feed = makeFeed({ bottleSize: 120, remainingMilk: 30 });
    expect(milkConsumed(feed)).toBe(90);
  });

  it("coerces string values to numbers", () => {
    const feed = makeFeed({
      bottleSize: "120" as unknown as number,
      remainingMilk: "30" as unknown as number,
    });
    expect(milkConsumed(feed)).toBe(90);
  });

  it("treats invalid values as zero", () => {
    const feed = makeFeed({
      bottleSize: Number.NaN,
      remainingMilk: Number.NaN,
    });
    expect(milkConsumed(feed)).toBe(0);
  });

  it("clamps to zero when more milk remains than the bottle size", () => {
    const feed = makeFeed({ bottleSize: 120, remainingMilk: 150 });
    expect(milkConsumed(feed)).toBe(0);
  });
});

describe("milkConsumed (breast feeds)", () => {
  it("returns actual milk for bottle feeds", () => {
    const feed = makeFeed({
      type: "bottle",
      bottleSize: 120,
      remainingMilk: 30,
      estimatedMilk: 50,
    });
    expect(milkConsumed(feed, 10)).toBe(90);
  });

  it("returns the per-feed override for breast feeds", () => {
    const feed = makeFeed({ type: "breast", duration: 600, estimatedMilk: 75 });
    expect(milkConsumed(feed, 10)).toBe(75);
  });

  it("estimates from duration and ml/min when no override is set", () => {
    const feed = makeFeed({ type: "breast", duration: 600 });
    expect(milkConsumed(feed, 10)).toBe(100);
  });

  it("rounds the estimate to the nearest ml", () => {
    const feed = makeFeed({ type: "breast", duration: 125 });
    expect(milkConsumed(feed, 10)).toBe(21);
  });

  it("treats a zero or negative rate as zero", () => {
    const feed = makeFeed({ type: "breast", duration: 600 });
    expect(milkConsumed(feed, 0)).toBe(0);
    expect(milkConsumed(feed, -5)).toBe(0);
  });

  it("treats an invalid override as zero", () => {
    const feed = makeFeed({
      type: "breast",
      duration: 600,
      estimatedMilk: Number.NaN,
    });
    expect(milkConsumed(feed, 10)).toBe(0);
  });

  it("exposes a default rate for the UI", () => {
    expect(DEFAULT_ML_PER_MINUTE).toBeGreaterThan(0);
  });
});

describe("generateFeedId", () => {
  it("returns a non-empty string", () => {
    expect(generateFeedId().length).toBeGreaterThan(0);
  });

  it("returns unique ids", () => {
    const ids = new Set(Array.from({ length: 1000 }, generateFeedId));
    expect(ids.size).toBe(1000);
  });
});

describe("totalMilk", () => {
  it("sums milk across feeds", () => {
    const feeds = [
      makeFeed({ bottleSize: 120, remainingMilk: 0 }),
      makeFeed({ bottleSize: 100, remainingMilk: 40 }),
    ];
    expect(totalMilk(feeds)).toBe(180);
  });

  it("returns 0 for empty list", () => {
    expect(totalMilk([])).toBe(0);
  });

  it("includes estimated breast milk using the rate", () => {
    const feeds = [
      makeFeed({ bottleSize: 120, remainingMilk: 20 }),
      makeFeed({ type: "breast", duration: 600 }),
    ];
    expect(totalMilk(feeds, 10)).toBe(200);
  });
});

describe("totalDuration", () => {
  it("sums duration across feeds", () => {
    const feeds = [makeFeed({ duration: 30 }), makeFeed({ duration: 45 })];
    expect(totalDuration(feeds)).toBe(75);
  });

  it("returns 0 for empty list", () => {
    expect(totalDuration([])).toBe(0);
  });
});

describe("formatDuration", () => {
  it("shows seconds when under a minute", () => {
    expect(formatDuration(45)).toBe("45sec");
    expect(formatDuration(60)).toBe("60sec");
  });

  it("shows minutes when over a minute", () => {
    expect(formatDuration(90)).toBe("1.5min");
  });
});

describe("sortFeedsByStart", () => {
  it("orders feeds chronologically by start time", () => {
    const feeds = [
      makeFeed({ feedId: "a", start: new Date("2024-01-01T12:00:00") }),
      makeFeed({ feedId: "b", start: new Date("2024-01-01T09:00:00") }),
      makeFeed({ feedId: "c", start: new Date("2024-01-01T10:00:00") }),
    ];
    expect(sortFeedsByStart(feeds).map((f) => f.feedId)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("does not mutate the input array", () => {
    const feeds = [
      makeFeed({ feedId: "b", start: new Date("2024-01-01T09:00:00") }),
      makeFeed({ feedId: "a", start: new Date("2024-01-01T12:00:00") }),
    ];
    sortFeedsByStart(feeds);
    expect(feeds.map((f) => f.feedId)).toEqual(["b", "a"]);
  });
});

describe("applyFeedEdit", () => {
  const base = () =>
    makeFeed({
      start: new Date("2024-01-01T00:00:00"),
      end: new Date("2024-01-01T00:05:00"),
      duration: 300,
    });

  it("updates bottleSize as a number", () => {
    const feed = applyFeedEdit(base(), "bottleSize", "120");
    expect(feed.bottleSize).toBe(120);
  });

  it("updates remainingMilk as a number", () => {
    const feed = applyFeedEdit(base(), "remainingMilk", "30");
    expect(feed.remainingMilk).toBe(30);
  });

  it("updates estimatedMilk as a number", () => {
    const feed = applyFeedEdit(base(), "estimatedMilk", "75");
    expect(feed.estimatedMilk).toBe(75);
  });

  it("clears estimatedMilk when the value is empty", () => {
    const feed = applyFeedEdit(
      { ...base(), estimatedMilk: 75 },
      "estimatedMilk",
      "",
    );
    expect(feed.estimatedMilk).toBeUndefined();
  });

  it("updates type", () => {
    const feed = applyFeedEdit(base(), "type", "breast");
    expect(feed.type).toBe("breast");
  });

  it("recomputes duration when start is edited", () => {
    const feed = applyFeedEdit(base(), "start", "2024-01-01T00:03:00");
    expect(feed.duration).toBe(120);
  });

  it("clamps duration to zero when end is before start", () => {
    const feed = applyFeedEdit(base(), "start", "2024-01-01T00:10:00");
    expect(feed.duration).toBe(0);
  });

  it("leaves unknown fields unchanged but stamps updatedAt", () => {
    const edited = applyFeedEdit(base(), "unknown", "x");
    const { updatedAt, ...rest } = edited;
    expect(rest).toEqual(base());
    expect(updatedAt).toBeGreaterThan(0);
  });
});

describe("feedElapsedMs", () => {
  it("returns elapsed milliseconds between now and start", () => {
    expect(feedElapsedMs(5000, 0, 0)).toBe(5000);
  });

  it("subtracts paused time", () => {
    expect(feedElapsedMs(10000, 0, 3000)).toBe(7000);
  });

  it("clamps negative values to zero", () => {
    expect(feedElapsedMs(2000, 5000, 0)).toBe(0);
  });
});

describe("feedElapsedSeconds", () => {
  it("converts elapsed milliseconds to whole seconds", () => {
    expect(feedElapsedSeconds(5000, 0, 0)).toBe(5);
  });

  it("floors partial seconds", () => {
    expect(feedElapsedSeconds(5500, 0, 0)).toBe(5);
  });

  it("subtracts paused time before converting", () => {
    expect(feedElapsedSeconds(10000, 0, 2000)).toBe(8);
  });
});

describe("feedsOnDate", () => {
  const date = new Date(2024, 0, 15);

  it("returns feeds that started on the given date", () => {
    const feeds = [
      makeFeed({ feedId: "a", start: new Date(2024, 0, 15, 9, 0) }),
      makeFeed({ feedId: "b", start: new Date(2024, 0, 15, 12, 0) }),
    ];
    expect(feedsOnDate(feeds, date).map((f) => f.feedId)).toEqual(["a", "b"]);
  });

  it("excludes feeds from other days", () => {
    const feeds = [
      makeFeed({ feedId: "a", start: new Date(2024, 0, 15, 9, 0) }),
      makeFeed({ feedId: "b", start: new Date(2024, 0, 14, 23, 59) }),
      makeFeed({ feedId: "c", start: new Date(2024, 0, 16, 0, 0) }),
    ];
    expect(feedsOnDate(feeds, date).map((f) => f.feedId)).toEqual(["a"]);
  });
});

describe("feedsSpanMultipleDays", () => {
  it("returns false for fewer than two feeds", () => {
    expect(feedsSpanMultipleDays([])).toBe(false);
    expect(feedsSpanMultipleDays([makeFeed()])).toBe(false);
  });

  it("returns false when all feeds are on the same day", () => {
    const feeds = [
      makeFeed({ start: new Date(2024, 0, 15, 9, 0) }),
      makeFeed({ start: new Date(2024, 0, 15, 23, 0) }),
    ];
    expect(feedsSpanMultipleDays(feeds)).toBe(false);
  });

  it("returns true when feeds span multiple days", () => {
    const feeds = [
      makeFeed({ start: new Date(2024, 0, 15, 9, 0) }),
      makeFeed({ start: new Date(2024, 0, 16, 9, 0) }),
    ];
    expect(feedsSpanMultipleDays(feeds)).toBe(true);
  });
});

describe("timeSinceLastFeed", () => {
  const now = new Date("2024-01-01T12:00:00").getTime();

  it("returns seconds since the most recent feed ended", () => {
    const feeds = [
      makeFeed({ feedId: "a", end: new Date("2024-01-01T11:00:00") }),
      makeFeed({ feedId: "b", end: new Date("2024-01-01T11:30:00") }),
    ];
    expect(timeSinceLastFeed(feeds, now)).toBe(30 * 60);
  });

  it("returns undefined for an empty list", () => {
    expect(timeSinceLastFeed([], now)).toBeUndefined();
  });

  it("clamps to zero when the last feed is in the future", () => {
    const feeds = [makeFeed({ end: new Date("2024-01-01T13:00:00") })];
    expect(timeSinceLastFeed(feeds, now)).toBe(0);
  });
});

describe("formatTimeSince", () => {
  it("shows just now under a minute", () => {
    expect(formatTimeSince(30)).toBe("just now");
  });

  it("shows minutes under an hour", () => {
    expect(formatTimeSince(45 * 60)).toBe("45m ago");
  });

  it("shows whole hours", () => {
    expect(formatTimeSince(2 * 60 * 60)).toBe("2h ago");
  });

  it("shows hours and minutes", () => {
    expect(formatTimeSince(2 * 60 * 60 + 14 * 60)).toBe("2h 14m ago");
  });
});

describe("medianFeedInterval", () => {
  it("returns undefined with fewer than two feeds", () => {
    expect(medianFeedInterval([])).toBeUndefined();
    expect(medianFeedInterval([makeFeed()])).toBeUndefined();
  });

  it("returns the median gap between feed starts", () => {
    const feeds = [
      makeFeed({ start: new Date("2024-01-01T00:00:00") }),
      makeFeed({ start: new Date("2024-01-01T03:00:00") }),
      makeFeed({ start: new Date("2024-01-01T06:00:00") }),
      makeFeed({ start: new Date("2024-01-01T10:00:00") }),
    ];
    // gaps: 3h, 3h, 4h -> median 3h
    expect(medianFeedInterval(feeds)).toBe(3 * 60 * 60 * 1000);
  });

  it("averages the two middle gaps for an even count", () => {
    const feeds = [
      makeFeed({ start: new Date("2024-01-01T00:00:00") }),
      makeFeed({ start: new Date("2024-01-01T02:00:00") }),
      makeFeed({ start: new Date("2024-01-01T04:00:00") }),
      makeFeed({ start: new Date("2024-01-01T08:00:00") }),
      makeFeed({ start: new Date("2024-01-01T12:00:00") }),
    ];
    // gaps: 2h, 2h, 4h, 4h -> median (2+4)/2 = 3h
    expect(medianFeedInterval(feeds)).toBe(3 * 60 * 60 * 1000);
  });
});

describe("timeUntilNextFeed", () => {
  it("returns undefined when there are no feeds", () => {
    expect(timeUntilNextFeed([])).toBeUndefined();
  });

  it("estimates seconds until the next feed from the median interval", () => {
    const feeds = [
      makeFeed({ start: new Date("2024-01-01T00:00:00") }),
      makeFeed({ start: new Date("2024-01-01T03:00:00") }),
    ];
    const now = new Date("2024-01-01T04:00:00").getTime();
    expect(timeUntilNextFeed(feeds, now)).toBe(2 * 60 * 60);
  });

  it("clamps to zero when already due", () => {
    const feeds = [
      makeFeed({ start: new Date("2024-01-01T00:00:00") }),
      makeFeed({ start: new Date("2024-01-01T03:00:00") }),
    ];
    const now = new Date("2024-01-01T08:00:00").getTime();
    expect(timeUntilNextFeed(feeds, now)).toBe(0);
  });
});

describe("formatTimeUntil", () => {
  it("shows due now for non-positive values", () => {
    expect(formatTimeUntil(0)).toBe("due now");
    expect(formatTimeUntil(-5)).toBe("due now");
  });

  it("shows in <1m under a minute", () => {
    expect(formatTimeUntil(30)).toBe("in <1m");
  });

  it("shows minutes under an hour", () => {
    expect(formatTimeUntil(45 * 60)).toBe("in 45m");
  });

  it("shows whole hours", () => {
    expect(formatTimeUntil(2 * 60 * 60)).toBe("in 2h");
  });

  it("shows hours and minutes", () => {
    expect(formatTimeUntil(2 * 60 * 60 + 14 * 60)).toBe("in 2h 14m");
  });
});
