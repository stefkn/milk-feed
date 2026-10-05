import type { FeedLog } from "./types";

/** Keeps versions and tombstones so restoring a backup remains safe to sync. */
export function feedsToJson(feeds: FeedLog[]): string {
  return JSON.stringify(
    {
      version: 1,
      feeds: feeds.map((feed) => ({
        ...feed,
        start: new Date(feed.start).toISOString(),
        end: new Date(feed.end).toISOString(),
      })),
    },
    null,
    2,
  );
}

export function jsonToFeeds(text: string): FeedLog[] {
  const backup = JSON.parse(text);
  if (!backup || backup.version !== 1 || !Array.isArray(backup.feeds)) {
    throw new Error("Please choose a MilkFeed JSON backup (version 1).");
  }
  const ids = new Set<string>();
  const nonNegative = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;
  return backup.feeds.map((feed: FeedLog, index: number) => {
    if (
      !feed ||
      typeof feed.feedId !== "string" ||
      !feed.feedId.trim() ||
      ids.has(feed.feedId) ||
      !["bottle", "breast"].includes(feed.type) ||
      typeof feed.start !== "string" ||
      typeof feed.end !== "string" ||
      !Number.isFinite(new Date(feed.start).getTime()) ||
      !Number.isFinite(new Date(feed.end).getTime()) ||
      new Date(feed.end).getTime() < new Date(feed.start).getTime() ||
      ![feed.duration, feed.bottleSize, feed.remainingMilk].every(
        nonNegative,
      ) ||
      feed.remainingMilk > feed.bottleSize ||
      [feed.estimatedMilk, feed.updatedAt, feed.deletedAt].some(
        (n) => n !== undefined && !nonNegative(n),
      )
    ) {
      throw new Error(
        `Invalid feed at row ${index + 1}. Nothing was imported.`,
      );
    }
    ids.add(feed.feedId);
    return { ...feed };
  });
}
