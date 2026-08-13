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
