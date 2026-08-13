import { describe, it, expect } from "vitest";
import {
  milkConsumed,
  totalMilk,
  totalDuration,
  formatDuration,
  applyFeedEdit,
  feedElapsedMs,
  feedElapsedSeconds,
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

  it("recomputes duration when start is edited", () => {
    const feed = applyFeedEdit(base(), "start", "2024-01-01T00:03:00");
    expect(feed.duration).toBe(120);
  });

  it("clamps duration to zero when end is before start", () => {
    const feed = applyFeedEdit(base(), "start", "2024-01-01T00:10:00");
    expect(feed.duration).toBe(0);
  });

  it("leaves unknown fields unchanged", () => {
    expect(applyFeedEdit(base(), "unknown", "x")).toEqual(base());
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
