import type { DateInput } from "@formkit/tempo";

export type FeedLog = {
    feedId: string;
    start: DateInput;
    end: DateInput;
    duration: number;
    bottleSize: number;
    remainingMilk: number;
    estimatedMilk?: number;
    type: string;
    updatedAt?: number;
    deletedAt?: number;
}

export interface FeedingChartInterface {
    updateFeedChart: (previousFeeds: FeedLog[]) => void;
}

export interface TimelineInterface {
    updateTimeline: (previousFeeds: FeedLog[]) => void;
}