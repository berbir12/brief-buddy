import { Router } from "express";
import { z } from "zod";
import { briefingQueue, buildBriefingJobId } from "../../scheduler/queue";
import { getBriefingMetrics, getIntegrationsStatus, listBriefingJobEvents, pool } from "../../db/queries";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { runBriefingPipeline } from "../../agents/orchestrator";

export const briefingsRouter = Router();
const modeSchema = z.enum(["morning", "evening", "weekly", "alert"]);
const eventLimitSchema = z.coerce.number().int().min(1).max(200).optional();

async function getUserQueueStats(userId: string): Promise<{
  waiting: number;
  active: number;
  delayed: number;
  completedRecent: number;
  failedRecent: number;
}> {
  let waitingJobs: Awaited<ReturnType<typeof briefingQueue.getJobs>> = [];
  let activeJobs: Awaited<ReturnType<typeof briefingQueue.getJobs>> = [];
  let delayedJobs: Awaited<ReturnType<typeof briefingQueue.getJobs>> = [];
  try {
    [waitingJobs, activeJobs, delayedJobs] = await Promise.all([
      briefingQueue.getJobs(["waiting"], 0, 500),
      briefingQueue.getJobs(["active"], 0, 500),
      briefingQueue.getJobs(["delayed"], 0, 500)
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[briefings] queue stats unavailable (Redis?):", msg);
  }
  let events: Awaited<ReturnType<typeof listBriefingJobEvents>> = [];
  try {
    events = await listBriefingJobEvents(userId, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[briefings] job events unavailable:", msg);
  }
  const failedRecent = events.filter((event) => event.eventType === "failed").length;
  const completedRecent = events.filter((event) => event.eventType === "completed").length;
  const countForUser = (jobs: Awaited<ReturnType<typeof briefingQueue.getJobs>>) =>
    jobs.filter((job) => String(job.data?.userId ?? "") === userId).length;

  return {
    waiting: countForUser(waitingJobs),
    active: countForUser(activeJobs),
    delayed: countForUser(delayedJobs),
    completedRecent,
    failedRecent
  };
}

briefingsRouter.post("/trigger", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const parsed = modeSchema.safeParse(req.body?.mode ?? "morning");
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid briefing mode" });
    return;
  }
  const mode = parsed.data;
  const result = await runBriefingPipeline(userId, mode);
  res.json(result);
});

briefingsRouter.post("/enqueue", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const parsed = modeSchema.safeParse(req.body?.mode ?? "morning");
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid briefing mode" });
    return;
  }
  const mode = parsed.data;
  const jobId = buildBriefingJobId(userId, mode);
  const existing = await briefingQueue.getJob(jobId);
  if (existing) {
    res.json({ jobId: existing.id, deduplicated: true, state: await existing.getState() });
    return;
  }

  const job = await briefingQueue.add(mode, { userId, mode }, { jobId });
  res.json({ jobId: job.id, deduplicated: false });
});

briefingsRouter.get("/history", requireAuth, async (req: AuthenticatedRequest, res) => {
  const result = await pool.query(
    `SELECT id, mode, script, audio_url AS "audioUrl", delivery_status AS "deliveryStatus", delivered_at AS "deliveredAt", created_at AS "createdAt"
     FROM briefings
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.user!.id]
  );
  res.json(result.rows);
});

briefingsRouter.get("/metrics", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const metrics = await getBriefingMetrics(userId);
  const deliveryRate7d = metrics.generated7d > 0 ? Number((metrics.delivered7d / metrics.generated7d).toFixed(3)) : 0;
  res.json({
    ...metrics,
    deliveryRate7d
  });
});

briefingsRouter.get("/jobs/events", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const parsedLimit = eventLimitSchema.safeParse(req.query.limit);
  if (!parsedLimit.success && req.query.limit !== undefined) {
    res.status(400).json({ error: "Invalid limit query param" });
    return;
  }
  const events = await listBriefingJobEvents(userId, parsedLimit.data ?? 50);
  res.json(events);
});

briefingsRouter.get("/jobs/queue-stats", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const counts = await getUserQueueStats(userId);
  res.json({
    queue: "briefings",
    scope: "user",
    counts
  });
});

briefingsRouter.get("/system-health", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const [metricsRaw, queue, integrations] = await Promise.all([
    getBriefingMetrics(userId),
    getUserQueueStats(userId),
    getIntegrationsStatus(userId)
  ]);
  const metrics = {
    ...metricsRaw,
    deliveryRate7d: metricsRaw.generated7d > 0 ? Number((metricsRaw.delivered7d / metricsRaw.generated7d).toFixed(3)) : 0
  };

  const warnings: string[] = [];
  if (queue.failedRecent > 0) {
    warnings.push(`${queue.failedRecent} recent job failure(s) detected.`);
  }
  const reconnects = integrations.filter((integration) => integration.requiresReconnect).map((integration) => integration.provider);
  if (reconnects.length > 0) {
    warnings.push(`Reconnect required: ${reconnects.join(", ")}.`);
  }
  if (metrics.undelivered7d > 0) {
    warnings.push(`${metrics.undelivered7d} undelivered briefing(s) in the last 7 days.`);
  }
  if (queue.waiting + queue.delayed >= 10) {
    warnings.push(`Queue backlog is high (${queue.waiting + queue.delayed} waiting/delayed jobs).`);
  }
  if (queue.active >= 5) {
    warnings.push(`High active worker load detected (${queue.active} active jobs).`);
  }

  res.json({
    generatedAt: new Date().toISOString(),
    metrics,
    queue,
    integrations,
    warnings
  });
});
