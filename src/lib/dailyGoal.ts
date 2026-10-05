import { writable } from "svelte/store";

export const DEFAULT_DAILY_GOAL_ML = 600;

export const dailyGoalMl = writable(DEFAULT_DAILY_GOAL_ML);

export function clampDailyGoal(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DAILY_GOAL_ML;
  // clamp to sane range 50 – 3000 ml
  return Math.min(3000, Math.max(50, Math.round(n)));
}

export function progressPercent(totalMl: number, goalMl: number): number {
  if (!Number.isFinite(totalMl) || !Number.isFinite(goalMl) || goalMl <= 0)
    return 0;
  return Math.min(100, Math.max(0, Math.floor((totalMl / goalMl) * 100)));
}

export function remainingToGoal(totalMl: number, goalMl: number): number {
  return Math.max(0, goalMl - totalMl);
}
