import { describe, it, expect } from "vitest";
import {
  milkConsumed,
  totalMilk,
  totalDuration,
  formatDuration,
  sortFeedsByStart,
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
