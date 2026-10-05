import { describe, expect, it } from "vitest";
import type { FeedLog } from "./types";
import {
  activeFeeds,
  mergeFeedsLWW,
  stampFeed,
  tombstoneFeed,
  undoFeedDeletions,
} from "./sync";

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

describe("deletion undo", () => {
  it("restores with a version newer than the tombstone even if the clock moves back", () => {
    const original = feed();
    const deleted = tombstoneFeed(original, 200);
    const restored = undoFeedDeletions([deleted], [original], [deleted], 150);
    expect(activeFeeds(mergeFeedsLWW([deleted], restored))).toHaveLength(1);
    expect(restored[0].updatedAt).toBe(201);
    expect(restored[0].deletedAt).toBeUndefined();
  });
  it("preserves feeds added or edited after deletion and supports multiple independent undos", () => {
    const a = feed(),
      b = feed({ feedId: "b" });
    const da = tombstoneFeed(a, 200),
      db = tombstoneFeed(b, 300);
    const added = feed({ feedId: "c", updatedAt: 400 });
    const first = undoFeedDeletions([da, db, added], [a], [da], 500);
    const second = undoFeedDeletions(first, [b], [db], 600);
    expect(activeFeeds(second).map((f) => f.feedId)).toEqual(["a", "b", "c"]);
    expect(second[2]).toBe(added);
  });
  it("does not undo a later peer edit or deletion", () => {
    const original = feed(),
      deleted = tombstoneFeed(original, 200);
    for (const later of [
      stampFeed(original, 300),
      tombstoneFeed(deleted, 300),
    ]) {
      expect(undoFeedDeletions([later], [original], [deleted], 400)).toEqual([
        later,
      ]);
    }
  });
  it("does not reset older tombstones during bulk delete", () => {
    const old = tombstoneFeed(feed({ feedId: "old" }), 50);
    const original = feed(),
      deleted = tombstoneFeed(original, 200);
    expect(
      undoFeedDeletions([old, deleted], [original], [deleted], 300)[0],
    ).toBe(old);
  });
});
