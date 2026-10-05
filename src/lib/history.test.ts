import { describe, expect, it } from "vitest";
import type { FeedLog } from "./types";
import { groupFeedsByDay } from "./history";

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

describe("history", () => {
  it("groups by local calendar date, sorts days newest first, preserves row order", () => {
    const now = new Date(2026, 9, 5, 12);
    const groups = groupFeedsByDay(
      [feed({ start: new Date(2026, 9, 4, 23) }), feed({ feedId: "b" })],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday"]);
    expect(groups[0].key).toBe("2026-10-05");
  });
  it("labels yesterday correctly across the end of daylight saving time", () => {
    const groups = groupFeedsByDay(
      [feed({ start: new Date(2026, 9, 25, 12) })],
      new Date(2026, 9, 26, 12),
    );
    expect(groups[0].label).toBe("Yesterday");
  });
});
