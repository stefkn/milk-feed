import { describe, it, expect } from "vitest";
import { feedsToCsv, csvToFeeds, mergeFeedsById, CSV_HEADERS } from "./csv";
import type { FeedLog } from "./types";

function makeFeed(overrides: Partial<FeedLog> = {}): FeedLog {
  return {
    feedId: "1",
    start: new Date("2024-01-01T12:30:45"),
    end: new Date("2024-01-01T12:45:45"),
    duration: 900,
    bottleSize: 120,
    remainingMilk: 30,
    type: "bottle",
    ...overrides,
  };
}

describe("feedsToCsv", () => {
  it("writes a header row followed by one row per feed", () => {
    const csv = feedsToCsv([makeFeed()]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(CSV_HEADERS.join(","));
    expect(lines).toHaveLength(2);
  });

  it("formats dates as local ISO without timezone", () => {
    const csv = feedsToCsv([makeFeed()]);
    expect(csv).toContain("2024-01-01T12:30:45");
    expect(csv).toContain("2024-01-01T12:45:45");
  });

  it("round-trips a feed without losing data", () => {
    const feed = makeFeed();
    const [restored] = csvToFeeds(feedsToCsv([feed]));

    expect(restored.feedId).toBe(feed.feedId);
    expect(new Date(restored.start).getTime()).toBe(
      new Date(feed.start).getTime(),
    );
    expect(new Date(restored.end).getTime()).toBe(new Date(feed.end).getTime());
    expect(restored.duration).toBe(feed.duration);
    expect(restored.bottleSize).toBe(feed.bottleSize);
    expect(restored.remainingMilk).toBe(feed.remainingMilk);
    expect(restored.type).toBe(feed.type);
  });

  it("escapes fields containing commas and quotes", () => {
    const feed = makeFeed({ type: 'bottle, "large"' });
    const [restored] = csvToFeeds(feedsToCsv([feed]));
    expect(restored.type).toBe('bottle, "large"');
  });
});

describe("csvToFeeds", () => {
  it("returns an empty list for empty input", () => {
    expect(csvToFeeds("")).toEqual([]);
  });

  it("returns an empty list for a header-only file", () => {
    expect(csvToFeeds(CSV_HEADERS.join(","))).toEqual([]);
  });

  it("maps columns by header name rather than position", () => {
    const csv = [
      "remainingMilk,start,type,feedId,end,duration,bottleSize",
      "30,2024-01-01T12:30:45,bottle,1,2024-01-01T12:45:45,900,120",
    ].join("\n");
    const [feed] = csvToFeeds(csv);
    expect(feed.feedId).toBe("1");
    expect(feed.bottleSize).toBe(120);
    expect(feed.duration).toBe(900);
  });

  it("ignores a UTF-8 BOM on the header", () => {
    const csv = `\uFEFF${CSV_HEADERS.join(",")}\n1,2024-01-01T12:30:45,2024-01-01T12:45:45,900,120,30,bottle`;
    const [feed] = csvToFeeds(csv);
    expect(feed.feedId).toBe("1");
  });

  it("skips rows with unparseable dates", () => {
    const csv = [
      CSV_HEADERS.join(","),
      "1,not-a-date,2024-01-01T12:45:45,900,120,30,bottle",
      "2,2024-01-01T12:30:45,2024-01-01T12:45:45,900,120,30,bottle",
    ].join("\n");
    const feeds = csvToFeeds(csv);
    expect(feeds).toHaveLength(1);
    expect(feeds[0].feedId).toBe("2");
  });

  it("coerces numeric fields and defaults type to bottle", () => {
    const csv = [
      CSV_HEADERS.join(","),
      "1,2024-01-01T12:30:45,2024-01-01T12:45:45,,,,",
    ].join("\n");
    const [feed] = csvToFeeds(csv);
    expect(feed.duration).toBe(0);
    expect(feed.bottleSize).toBe(0);
    expect(feed.remainingMilk).toBe(0);
    expect(feed.type).toBe("bottle");
  });

  it("generates a fallback feedId when missing", () => {
    const csv = [
      CSV_HEADERS.join(","),
      ",2024-01-01T12:30:45,2024-01-01T12:45:45,900,120,30,bottle",
    ].join("\n");
    const [feed] = csvToFeeds(csv);
    expect(feed.feedId).toBeTruthy();
  });
});

describe("mergeFeedsById", () => {
  it("overwrites feeds with matching ids and appends the rest", () => {
    const existing = [makeFeed({ feedId: "a" }), makeFeed({ feedId: "b" })];
    const imported = [
      makeFeed({ feedId: "a", bottleSize: 200 }),
      makeFeed({ feedId: "c" }),
    ];
    const merged = mergeFeedsById(existing, imported);

    expect(merged.map((f) => f.feedId)).toEqual(["a", "b", "c"]);
    expect(merged[0].bottleSize).toBe(200);
  });

  it("keeps existing feeds when nothing is imported", () => {
    const existing = [makeFeed({ feedId: "a" })];
    expect(mergeFeedsById(existing, [])).toEqual(existing);
  });
});
