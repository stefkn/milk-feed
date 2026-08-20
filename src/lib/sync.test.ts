import { describe, it, expect } from "vitest";
import {
  mergeFeedsLWW,
  activeFeeds,
  isDeletedFeed,
  stampFeed,
  tombstoneFeed,
  compareFeeds,
  feedVersion,
} from "./sync";
import type { FeedLog } from "./types";

function makeFeed(overrides: Partial<FeedLog> = {}): FeedLog {
  return {
    feedId: "1",
    start: new Date("2024-01-01T12:00:00"),
    end: new Date("2024-01-01T12:05:00"),
    duration: 300,
    bottleSize: 120,
    remainingMilk: 0,
    type: "bottle",
    ...overrides,
  };
}

function sortById(feeds: FeedLog[]): FeedLog[] {
  return [...feeds].sort((a, b) => (a.feedId < b.feedId ? -1 : 1));
}

describe("feedVersion", () => {
  it("defaults a missing updatedAt to zero", () => {
    expect(feedVersion(makeFeed())).toBe(0);
  });

  it("reads the updatedAt field", () => {
    expect(feedVersion(makeFeed({ updatedAt: 42 }))).toBe(42);
  });
});

describe("compareFeeds", () => {
  it("orders by updatedAt ascending", () => {
    expect(
      compareFeeds(makeFeed({ updatedAt: 1 }), makeFeed({ updatedAt: 2 })),
    ).toBeLessThan(0);
  });

  it("breaks ties by feedId deterministically", () => {
    expect(
      compareFeeds(makeFeed({ feedId: "a", updatedAt: 1 }), makeFeed({ feedId: "b", updatedAt: 1 })),
    ).toBeLessThan(0);
    expect(
      compareFeeds(makeFeed({ feedId: "b", updatedAt: 1 }), makeFeed({ feedId: "a", updatedAt: 1 })),
    ).toBeGreaterThan(0);
  });
});

describe("mergeFeedsLWW", () => {
  it("unions distinct feeds from both lists", () => {
    const a = [makeFeed({ feedId: "a" }), makeFeed({ feedId: "b" })];
    const b = [makeFeed({ feedId: "b" }), makeFeed({ feedId: "c" })];
    expect(sortById(mergeFeedsLWW(a, b)).map((f) => f.feedId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps the higher updatedAt for a shared feed", () => {
    const a = [makeFeed({ feedId: "x", updatedAt: 1, bottleSize: 100 })];
    const b = [makeFeed({ feedId: "x", updatedAt: 2, bottleSize: 200 })];
    const merged = mergeFeedsLWW(a, b);
    expect(merged).toHaveLength(1);
    expect(merged[0].bottleSize).toBe(200);
  });

  it("does not let an older version overwrite a newer one", () => {
    const a = [makeFeed({ feedId: "x", updatedAt: 2, bottleSize: 200 })];
    const b = [makeFeed({ feedId: "x", updatedAt: 1, bottleSize: 100 })];
    expect(mergeFeedsLWW(a, b)[0].bottleSize).toBe(200);
  });

  it("is commutative", () => {
    const a = [
      makeFeed({ feedId: "a", updatedAt: 1 }),
      makeFeed({ feedId: "b", updatedAt: 3 }),
    ];
    const b = [
      makeFeed({ feedId: "b", updatedAt: 2 }),
      makeFeed({ feedId: "c", updatedAt: 4 }),
    ];
    expect(sortById(mergeFeedsLWW(a, b))).toEqual(
      sortById(mergeFeedsLWW(b, a)),
    );
  });

  it("is idempotent", () => {
    const a = [makeFeed({ feedId: "a", updatedAt: 1 })];
    const b = [makeFeed({ feedId: "a", updatedAt: 2 })];
    const once = mergeFeedsLWW(a, b);
    expect(mergeFeedsLWW(once, b)).toEqual(once);
    expect(mergeFeedsLWW(a, once)).toEqual(once);
  });

  it("preserves a tombstone over a stale live copy", () => {
    const live = makeFeed({ feedId: "x", updatedAt: 5 });
    const deleted = makeFeed({ feedId: "x", updatedAt: 10, deletedAt: 10 });
    expect(mergeFeedsLWW([live], [deleted])[0].deletedAt).toBe(10);
  });
});

describe("activeFeeds", () => {
  it("filters out tombstoned feeds", () => {
    const feeds = [
      makeFeed({ feedId: "a" }),
      makeFeed({ feedId: "b", deletedAt: 1 }),
    ];
    expect(activeFeeds(feeds).map((f) => f.feedId)).toEqual(["a"]);
  });

  it("returns all feeds when none are deleted", () => {
    const feeds = [makeFeed({ feedId: "a" }), makeFeed({ feedId: "b" })];
    expect(activeFeeds(feeds)).toHaveLength(2);
  });
});

describe("isDeletedFeed", () => {
  it("treats a positive deletedAt as deleted", () => {
    expect(isDeletedFeed(makeFeed({ deletedAt: 1 }))).toBe(true);
    expect(isDeletedFeed(makeFeed({ deletedAt: 0 }))).toBe(false);
    expect(isDeletedFeed(makeFeed())).toBe(false);
  });
});

describe("stampFeed", () => {
  it("sets updatedAt without mutating the original", () => {
    const feed = makeFeed({ feedId: "a" });
    const stamped = stampFeed(feed, 123);
    expect(stamped.updatedAt).toBe(123);
    expect(feed.updatedAt).toBeUndefined();
  });
});

describe("tombstoneFeed", () => {
  it("sets updatedAt and deletedAt without mutating the original", () => {
    const feed = makeFeed({ feedId: "a" });
    const tombstoned = tombstoneFeed(feed, 123);
    expect(tombstoned.updatedAt).toBe(123);
    expect(tombstoned.deletedAt).toBe(123);
    expect(feed.deletedAt).toBeUndefined();
  });
});
