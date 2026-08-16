import type { FeedLog } from "./types";

export const DEFAULT_NIGHT_START_HOUR = 20;
export const DEFAULT_NIGHT_END_HOUR = 6;

const RIGHT_MARGIN_MS = 5 * 60 * 1000;
const MIN_PADDING_MS = 30 * 60 * 1000;

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
  return { min: dataMin - padding, max: dataMax + RIGHT_MARGIN_MS };
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

  for (
    const day = new Date(firstDay);
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
