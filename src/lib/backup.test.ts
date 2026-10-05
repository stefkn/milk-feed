import { describe, expect, it } from "vitest";
import type { FeedLog } from "./types";
import { feedsToJson, jsonToFeeds } from "./backup";
import { activeFeeds, mergeFeedsLWW, tombstoneFeed } from "./sync";

const feed = (overrides: Partial<FeedLog> = {}): FeedLog => ({
  feedId: "a",
  start: new Date(2026, 9, 5, 12),
  end: new Date(2026, 9, 5, 12, 15),
  duration: 900,
  bottleSize: 120,
  remainingMilk: 20,
  type: "bottle",
  updatedAt: 100,
  ...overrides,
});

describe("backup", () => {
  it("roundtrips exact instants, explicit zero estimates, versions, and tombstones", () => {
    const originals = [
      feed({ type: "breast", estimatedMilk: 0 }),
      tombstoneFeed(feed({ feedId: "b" }), 200),
    ];
    const restored = jsonToFeeds(feedsToJson(originals));
    expect(feedsToJson(restored)).toBe(feedsToJson(originals));
    expect(activeFeeds(restored)).toHaveLength(1);
    expect(mergeFeedsLWW(originals, restored)).toHaveLength(2);
  });
  it("rejects invalid backups without returning a partial import", () => {
    for (const invalid of [
      null,
      {},
      { version: 2, feeds: [] },
      { version: 1, feeds: [null] },
      { version: 1, feeds: [{ ...feed(), start: "bad" }] },
    ]) {
      expect(() => jsonToFeeds(JSON.stringify(invalid))).toThrow();
    }
    expect(() => jsonToFeeds(feedsToJson([feed(), feed()]))).toThrow(
      /Invalid feed/,
    );
  });
  it("rejects invalid amounts and metadata", () => {
    for (const overrides of [
      { remainingMilk: 121 },
      { duration: -1 },
      { updatedAt: -1 },
      { estimatedMilk: -2 },
    ]) {
      expect(() => jsonToFeeds(feedsToJson([feed(overrides)]))).toThrow();
    }
  });
});
