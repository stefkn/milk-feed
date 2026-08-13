import { parse, diffSeconds } from "@formkit/tempo";
import type { FeedLog } from "./types";

export function milkConsumed(feed: FeedLog): number {
  const bottleSize = Number(feed.bottleSize) || 0;
  const remainingMilk = Number(feed.remainingMilk) || 0;
  return bottleSize - remainingMilk;
}

export function totalMilk(feeds: FeedLog[]): number {
  return feeds.reduce((acc, feed) => acc + milkConsumed(feed), 0);
}

export function totalDuration(feeds: FeedLog[]): number {
  return feeds.reduce((acc, feed) => acc + (Number(feed.duration) || 0), 0);
}

export function formatDuration(seconds: number): string {
  if (seconds <= 60) {
    return `${seconds}sec`;
  }
  return `${(seconds / 60).toFixed(1)}min`;
}

export function sortFeedsByStart(feeds: FeedLog[]): FeedLog[] {
  return [...feeds].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

export function applyFeedEdit(
  feed: FeedLog,
  field: string,
  value: string,
): FeedLog {
  const updatedFeed: FeedLog = { ...feed };

  switch (field) {
    case "start":
      updatedFeed.start = parse(value, "YYYY-MM-DDTHH:mm", "en");
      break;
    case "end":
      updatedFeed.end = parse(value, "YYYY-MM-DDTHH:mm", "en");
      break;
    case "bottleSize":
      updatedFeed.bottleSize = Number(value);
      break;
    case "remainingMilk":
      updatedFeed.remainingMilk = Number(value);
      break;
    case "duration":
      updatedFeed.duration = Number(value);
      break;
  }

  updatedFeed.duration = Math.max(
    0,
    diffSeconds(updatedFeed.end, updatedFeed.start),
  );
  return updatedFeed;
}

export function feedElapsedMs(
  nowMs: number,
  feedStartMs: number,
  pausedMs: number,
): number {
  return Math.max(0, nowMs - feedStartMs - pausedMs);
}

export function feedElapsedSeconds(
  nowMs: number,
  feedStartMs: number,
  pausedMs: number,
): number {
  return Math.floor(feedElapsedMs(nowMs, feedStartMs, pausedMs) / 1000);
}
