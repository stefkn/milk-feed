import { describe, it, expect } from "vitest";
import {
  feedsOnDate,
  totalMilk,
  totalDuration,
  timeUntilNextFeed,
} from "./feed";
import { feedsToCsv, csvToFeeds } from "./csv";
import { mergeFeedsLWW, stampFeed } from "./sync";
import type { FeedLog } from "./types";

function makeFeed(overrides: Partial<FeedLog> = {}): FeedLog {
  return {
    feedId: "1",
    start: new Date("2024-01-15T00:00:00"),
    end: new Date("2024-01-15T00:10:00"),
    duration: 600,
    bottleSize: 120,
    remainingMilk: 20,
    type: "bottle",
    ...overrides,
  };
}

describe("a day of feeding", () => {
  it("aggregates today's feeds from a mixed history", () => {
    const feeds = [
      makeFeed({
        feedId: "a",
        start: new Date("2024-01-15T06:00:00"),
        end: new Date("2024-01-15T06:15:00"),
        duration: 900,
        bottleSize: 120,
        remainingMilk: 20,
      }),
      makeFeed({
        feedId: "b",
        start: new Date("2024-01-15T09:00:00"),
        end: new Date("2024-01-15T09:20:00"),
        duration: 1200,
        bottleSize: 150,
        remainingMilk: 0,
      }),
      makeFeed({
        feedId: "c",
        start: new Date("2024-01-14T22:00:00"),
        end: new Date("2024-01-14T22:10:00"),
        duration: 600,
        bottleSize: 100,
        remainingMilk: 0,
      }),
    ];

    const todayFeeds = feedsOnDate(feeds, new Date(2024, 0, 15));

    expect(todayFeeds.map((f) => f.feedId)).toEqual(["a", "b"]);
    // 100ml + 150ml = 250ml consumed today.
    expect(totalMilk(todayFeeds)).toBe(250);
    // 15 + 20 = 35 minutes.
    expect(totalDuration(todayFeeds)).toBe(2100);
  });

  it("estimates the next feed from the recent schedule", () => {
    const feeds = [
      makeFeed({ start: new Date("2024-01-15T06:00:00") }),
      makeFeed({ start: new Date("2024-01-15T09:00:00") }),
      makeFeed({ start: new Date("2024-01-15T12:00:00") }),
    ];
    const now = new Date("2024-01-15T14:00:00").getTime();

    // Three-hour gaps put the next feed an hour away.
    expect(timeUntilNextFeed(feeds, now)).toBe(1 * 60 * 60);
  });

  it("round-trips a mixed history through CSV", () => {
    const feeds = [
      makeFeed({
        feedId: "a",
        bottleSize: 120,
        remainingMilk: 20,
      }),
      makeFeed({
        feedId: "b",
        type: "breast",
        duration: 600,
        estimatedMilk: 75,
        bottleSize: 0,
        remainingMilk: 0,
      }),
    ];

    const restored = csvToFeeds(feedsToCsv(feeds));

    expect(restored.map((f) => f.feedId)).toEqual(["a", "b"]);
    expect(restored[0].bottleSize).toBe(120);
    expect(restored[1].type).toBe("breast");
    expect(restored[1].estimatedMilk).toBe(75);
  });

  it("merges an imported file over existing data by id", () => {
    const existing = [makeFeed({ feedId: "a", bottleSize: 100 })];
    const imported = csvToFeeds(
      feedsToCsv([
        makeFeed({ feedId: "a", bottleSize: 200 }),
        makeFeed({ feedId: "b" }),
      ]),
    ).map((feed) => stampFeed(feed));

    const merged = mergeFeedsLWW(existing, imported);

    expect(merged.map((f) => f.feedId)).toEqual(["a", "b"]);
    expect(merged.find((f) => f.feedId === "a")?.bottleSize).toBe(200);
  });
});
