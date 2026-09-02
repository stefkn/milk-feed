import { format, parse } from "@formkit/tempo";
import type { FeedLog } from "./types";

export const CSV_HEADERS = [
  "feedId",
  "start",
  "end",
  "duration",
  "bottleSize",
  "remainingMilk",
  "estimatedMilk",
  "type",
] as const;

const DATE_FORMAT = "YYYY-MM-DDTHH:mm:ss";

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function feedsToCsv(feeds: FeedLog[]): string {
  const lines: string[] = [CSV_HEADERS.join(",")];

  for (const feed of feeds) {
    const row = [
      feed.feedId,
      format(feed.start, DATE_FORMAT, "en"),
      format(feed.end, DATE_FORMAT, "en"),
      String(feed.duration),
      String(feed.bottleSize),
      String(feed.remainingMilk),
      feed.estimatedMilk === undefined ? "" : String(feed.estimatedMilk),
      feed.type,
    ];
    lines.push(row.map(escapeCsvField).join(","));
  }

  return lines.join("\n");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

function toNumber(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function csvToFeedsWithStats(
  text: string,
): { feeds: FeedLog[]; skipped: number } {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length === 0) {
    return { feeds: [], skipped: 0 };
  }

  const header = rows[0];
  const columnIndex = (name: string) =>
    header.findIndex((cell) => cell.trim() === name);

  const feedIdIdx = columnIndex("feedId");
  const startIdx = columnIndex("start");
  const endIdx = columnIndex("end");
  const durationIdx = columnIndex("duration");
  const bottleSizeIdx = columnIndex("bottleSize");
  const remainingMilkIdx = columnIndex("remainingMilk");
  const estimatedMilkIdx = columnIndex("estimatedMilk");
  const typeIdx = columnIndex("type");

  const feeds: FeedLog[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((cell) => cell.trim() === "")) {
      continue;
    }

    try {
      feeds.push({
        feedId: cell(row, feedIdIdx) || `imported-${Date.now()}-${i}`,
        start: parse(cell(row, startIdx), DATE_FORMAT, "en"),
        end: parse(cell(row, endIdx), DATE_FORMAT, "en"),
        duration: toNumber(cell(row, durationIdx)),
        bottleSize: toNumber(cell(row, bottleSizeIdx)),
        remainingMilk: toNumber(cell(row, remainingMilkIdx)),
        estimatedMilk:
          cell(row, estimatedMilkIdx) === ""
            ? undefined
            : toNumber(cell(row, estimatedMilkIdx)),
        type: cell(row, typeIdx) || "bottle",
      });
    } catch {
      skipped += 1;
    }
  }

  return { feeds, skipped };
}

export function csvToFeeds(text: string): FeedLog[] {
  return csvToFeedsWithStats(text).feeds;
}
