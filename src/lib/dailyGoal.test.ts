import { describe, expect, it } from "vitest";
import type { FeedLog } from "./types";
import { clampDailyGoal, progressPercent, remainingToGoal } from "./dailyGoal";
import { feedValidationError } from "./feedValidation";

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

describe("goal and validation", () => {
  it("clamps goals and avoids announcing success before the target is met", () => {
    expect(clampDailyGoal(undefined)).toBe(600);
    expect(clampDailyGoal(-1)).toBe(600);
    expect(clampDailyGoal(10)).toBe(50);
    expect(clampDailyGoal(4000)).toBe(3000);
    expect(progressPercent(599, 600)).toBe(99);
    expect(progressPercent(600, 600)).toBe(100);
    expect(progressPercent(NaN, 600)).toBe(0);
    expect(remainingToGoal(700, 600)).toBe(0);
  });
  it("rejects missing amounts, invalid dates, and negative estimates", () => {
    expect(feedValidationError(feed())).toBe("");
    expect(
      feedValidationError(feed({ bottleSize: undefined as unknown as number })),
    ).not.toBe("");
    expect(feedValidationError(feed({ start: "invalid" }))).not.toBe("");
    expect(feedValidationError(feed({ end: feed().start }))).not.toBe("");
    expect(
      feedValidationError(feed({ type: "breast", estimatedMilk: -1 })),
    ).not.toBe("");
    expect(
      feedValidationError(feed({ type: "breast", estimatedMilk: 0 })),
    ).toBe("");
  });
});
