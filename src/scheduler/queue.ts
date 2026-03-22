import { Queue } from "bullmq";
import { env } from "../config/env";
export { buildBriefingJobId, type BriefingMode } from "./jobIds";

export const redisConnection = {
  url: env.REDIS_URL
};

export type BriefingJobName = "morning-briefing" | "evening-wrapup" | "weekly-recap" | "urgency-watcher";

export const briefingQueue = new Queue("briefings", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000
    },
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 1000
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
      count: 5000
    }
  }
});
