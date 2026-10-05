import { format } from "@formkit/tempo";
import type { FeedLog } from "./types";

export type DayGroup = {
  key: string; // YYYY-MM-DD
  label: string; // e.g. "Today", "Yesterday", "Dec 19, 2024"
  date: Date;
  feeds: FeedLog[];
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function groupFeedsByDay(
  feeds: FeedLog[],
  now: Date = new Date(),
): DayGroup[] {
  // feeds assumed sorted ascending; group preserves order
  const map = new Map<string, FeedLog[]>();
  const dateForKey = new Map<string, Date>();

  for (const feed of feeds) {
    const d = new Date(feed.start);
    const key = dateKey(d);
    if (!map.has(key)) {
      map.set(key, []);
      dateForKey.set(key, startOfDay(d));
    }
    map.get(key)!.push(feed);
  }

  const todayKey = dateKey(startOfDay(now));
  const yesterday = startOfDay(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);

  const groups: DayGroup[] = [];
  for (const [key, groupFeeds] of map) {
    let label: string;
    if (key === todayKey) label = "Today";
    else if (key === yesterdayKey) label = "Yesterday";
    else label = format(dateForKey.get(key)!, { date: "medium" });
    groups.push({
      key,
      label,
      date: dateForKey.get(key)!,
      feeds: groupFeeds,
    });
  }

  // newest day first
  groups.sort((a, b) => b.date.getTime() - a.date.getTime());
  return groups;
}
