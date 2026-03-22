import { Worker } from "bullmq";
import { runBriefingPipeline } from "../agents/orchestrator";
import { redisConnection } from "./queue";
import { recordBriefingJobEvent } from "../db/queries";

export function createBriefingWorker(): Worker {
  return new Worker(
    "briefings",
    async (job) => {
      const userId = job.data?.userId as string | undefined;
      if (!userId) {
        throw new Error("Missing userId in briefing job payload");
      }
      const mode = (job.data?.mode as "morning" | "evening" | "weekly" | "alert" | undefined) ?? "morning";
      const jobId = String(job.id ?? "unknown");
      await recordBriefingJobEvent({
        userId,
        jobId,
        mode,
        eventType: "started"
      });

      try {
        await runBriefingPipeline(userId, mode);
        await recordBriefingJobEvent({
          userId,
          jobId,
          mode,
          eventType: "completed"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Worker execution failed";
        await recordBriefingJobEvent({
          userId,
          jobId,
          mode,
          eventType: "failed",
          detail: message
        });
        throw error;
      }
    },
    { connection: redisConnection }
  );
}
