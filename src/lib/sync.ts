import type { FeedLog } from "./types";

/**
 * A message exchanged between two peers during a shared session.
 *
 * V1 only ever sends full-state snapshots: the feed log is small enough that
 * shipping the whole list on every change keeps the protocol trivial and the
 * merge idempotent.
 */
export type SyncMessage = {
  type: "feeds";
  feeds: FeedLog[];
};

export function feedVersion(feed: FeedLog): number {
  return Number(feed.updatedAt) || 0;
}

export function isDeletedFeed(feed: FeedLog): boolean {
  return Number(feed.deletedAt) > 0;
}

/**
 * Total order over two feeds used for last-write-wins resolution.
 *
 * Compare versions and IDs, then deletion timestamps and canonical content.
 * Concurrent writes to the same ID and version converge on every device.
 */
export function compareFeeds(a: FeedLog, b: FeedLog): number {
  const delta = feedVersion(a) - feedVersion(b);
  if (delta !== 0) {
    return delta;
  }
  if (a.feedId < b.feedId) {
    return -1;
  }
  if (a.feedId > b.feedId) {
    return 1;
  }
  const deletedDelta = (Number(a.deletedAt) || 0) - (Number(b.deletedAt) || 0);
  if (deletedDelta !== 0) return deletedDelta;
  const contentKey = (feed: FeedLog) =>
    JSON.stringify([
      new Date(feed.start).getTime(),
      new Date(feed.end).getTime(),
      feed.duration,
      feed.bottleSize,
      feed.remainingMilk,
      feed.estimatedMilk ?? null,
      feed.type,
    ]);
  const aKey = contentKey(a),
    bKey = contentKey(b);
  return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
}

/**
 * Merges two feed lists into one, keeping the higher version of each feed.
 *
 * Commutative and idempotent: applying the same merge on both peers always
 * converges to the same list, which is what makes reconnect + re-sync safe.
 */
export function mergeFeedsLWW(a: FeedLog[], b: FeedLog[]): FeedLog[] {
  const byId = new Map<string, FeedLog>();

  for (const feed of a) {
    const current = byId.get(feed.feedId);
    if (!current || compareFeeds(feed, current) > 0) {
      byId.set(feed.feedId, feed);
    }
  }
  for (const feed of b) {
    const current = byId.get(feed.feedId);
    if (!current || compareFeeds(feed, current) > 0) {
      byId.set(feed.feedId, feed);
    }
  }

  return Array.from(byId.values());
}

/**
 * Returns only the feeds that have not been tombstoned (deleted).
 *
 * Deletes are represented as tombstones rather than removals so that a
 * re-sync with a peer that still holds the feed will not resurrect it.
 */
export function activeFeeds(feeds: FeedLog[]): FeedLog[] {
  return feeds.filter((feed) => !isDeletedFeed(feed));
}

export function stampFeed(feed: FeedLog, nowMs: number = Date.now()): FeedLog {
  return { ...feed, updatedAt: Math.max(nowMs, feedVersion(feed) + 1) };
}

export function tombstoneFeed(
  feed: FeedLog,
  nowMs: number = Date.now(),
): FeedLog {
  const version = Math.max(nowMs, feedVersion(feed) + 1);
  return { ...feed, updatedAt: version, deletedAt: version };
}

/** Undo only this operation's deletions, preserving additions and later edits. */
export function undoFeedDeletions(
  current: FeedLog[],
  originals: FeedLog[],
  deleted: FeedLog[],
  nowMs: number = Date.now(),
): FeedLog[] {
  const originalsById = new Map(originals.map((feed) => [feed.feedId, feed]));
  const deletedById = new Map(deleted.map((feed) => [feed.feedId, feed]));
  return current.map((feed) => {
    const original = originalsById.get(feed.feedId);
    const deletion = deletedById.get(feed.feedId);
    if (
      !original ||
      !deletion ||
      !isDeletedFeed(feed) ||
      feedVersion(feed) !== feedVersion(deletion) ||
      feed.deletedAt !== deletion.deletedAt
    )
      return feed;
    const restored = {
      ...original,
      updatedAt: Math.max(nowMs, feedVersion(feed) + 1),
    };
    delete restored.deletedAt;
    return restored;
  });
}
