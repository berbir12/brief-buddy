export type BriefingMode = "morning" | "evening" | "weekly" | "alert";

function currentJobBucket(mode: BriefingMode, now: Date): string {
  if (mode === "alert") {
    const fifteenMinuteBucket = Math.floor(now.getTime() / (15 * 60 * 1000));
    return `alert-${fifteenMinuteBucket}`;
  }
  return now.toISOString().slice(0, 10);
}

export function buildBriefingJobId(userId: string, mode: BriefingMode, now: Date = new Date()): string {
  return `briefing-${userId}-${mode}-${currentJobBucket(mode, now)}`;
}
