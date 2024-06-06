import type { DateInput } from "@formkit/tempo";

export type FeedLog = {
    feedId: string;
    start: DateInput;
    end: DateInput;
    duration: number;
    bottleSize: number;
    type: string;
}

