import type { FeedLog } from "./types";

export function feedValidationError(feed: FeedLog): string {
  const start = new Date(feed.start).getTime();
  const end = new Date(feed.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end))
    return "Please enter valid start and end times.";
  if (end <= start) return "End time must be after start time.";
  if (feed.type !== "bottle" && feed.type !== "breast")
    return "Please choose a feed type.";
  if (feed.type === "bottle") {
    if (
      ![feed.bottleSize, feed.remainingMilk].every(
        (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
      )
    ) {
      return "Please enter non-negative bottle and remaining amounts.";
    }
    if (feed.remainingMilk > feed.bottleSize)
      return "Remaining milk cannot exceed bottle size.";
  }
  if (
    feed.type === "breast" &&
    feed.estimatedMilk !== undefined &&
    (!Number.isFinite(feed.estimatedMilk) || feed.estimatedMilk < 0)
  ) {
    return "Estimated milk must be a non-negative amount.";
  }
  return "";
}
