import type { FeedLog } from "./types";

export const DEFAULT_NIGHT_START_HOUR = 20;
export const DEFAULT_NIGHT_END_HOUR = 6;

export const MAX_TIMELINE_RANGE_MS = 4 * 24 * 60 * 60 * 1000;

const RIGHT_MARGIN_MS = 5 * 60 * 1000;
const MIN_PADDING_MS = 30 * 60 * 1000;

export function clampRangeToMax(
  minMs: number,
  maxMs: number,
  maxRangeMs: number = MAX_TIMELINE_RANGE_MS,
): { min: number; max: number } {
  const range = maxMs - minMs;
  if (range <= maxRangeMs) {
    return { min: minMs, max: maxMs };
  }
  const center = (minMs + maxMs) / 2;
  const half = maxRangeMs / 2;
  return { min: center - half, max: center + half };
}

export function defaultTimelineRange(
  feeds: FeedLog[],
  nowMs: number = Date.now(),
): { min: number; max: number } {
  if (feeds.length === 0) {
    return { min: nowMs - 3 * 60 * 60 * 1000, max: nowMs };
  }

  const starts = feeds.map((feed) => new Date(feed.start).getTime());
  const ends = feeds.map((feed) => new Date(feed.end).getTime());
  const dataMin = Math.min(...starts);
  const dataMax = Math.max(nowMs, ...ends);
  const span = dataMax - dataMin;
  const padding = Math.max(span * 0.2, MIN_PADDING_MS);
  const max = dataMax + RIGHT_MARGIN_MS;
  const min = Math.max(dataMin - padding, max - MAX_TIMELINE_RANGE_MS);
  return { min, max };
}

export function nightPeriodsInRange(
  minMs: number,
  maxMs: number,
  nightStartHour: number = DEFAULT_NIGHT_START_HOUR,
  nightEndHour: number = DEFAULT_NIGHT_END_HOUR,
): Array<[number, number]> {
  const periods: Array<[number, number]> = [];

  const firstDay = new Date(minMs);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(maxMs);
  lastDay.setHours(0, 0, 0, 0);

  // Start one day earlier so a night that began before `min` but ends in the
  // early hours of `min`'s day (00:00–06:00) is still included.
  const startDay = new Date(firstDay);
  startDay.setDate(startDay.getDate() - 1);

  for (
    const day = new Date(startDay);
    day.getTime() <= lastDay.getTime();
    day.setDate(day.getDate() + 1)
  ) {
    const nightStart = new Date(day);
    nightStart.setHours(nightStartHour, 0, 0, 0);

    const nightEnd = new Date(day);
    nightEnd.setDate(nightEnd.getDate() + 1);
    nightEnd.setHours(nightEndHour, 0, 0, 0);

    const start = Math.max(minMs, nightStart.getTime());
    const end = Math.min(maxMs, nightEnd.getTime());
    if (end > start) {
      periods.push([start, end]);
    }
  }

  return periods;
}

export function dayPeriodsInRange(
  minMs: number,
  maxMs: number,
  nightStartHour: number = DEFAULT_NIGHT_START_HOUR,
  nightEndHour: number = DEFAULT_NIGHT_END_HOUR,
): Array<[number, number]> {
  const periods: Array<[number, number]> = [];

  const firstDay = new Date(minMs);
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(maxMs);
  lastDay.setHours(0, 0, 0, 0);

  for (
    const day = new Date(firstDay);
    day.getTime() <= lastDay.getTime();
    day.setDate(day.getDate() + 1)
  ) {
    const dayStart = new Date(day);
    dayStart.setHours(nightEndHour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(nightStartHour, 0, 0, 0);

    const start = Math.max(minMs, dayStart.getTime());
    const end = Math.min(maxMs, dayEnd.getTime());
    if (end > start) {
      periods.push([start, end]);
    }
  }

  return periods;
}
