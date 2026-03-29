import { Router } from "express";
import { z } from "zod";
import { briefingQueue, buildBriefingJobId } from "../../scheduler/queue";
import {
  getBriefingMetrics,
  getIntegrationsStatus,
  getUserSchedule,
  listBriefingJobEvents,
  listReliabilityAlerts,
  pool,
  upsertBriefingFeedback
} from "../../db/queries";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { runBriefingPipeline } from "../../agents/orchestrator";

export const briefingsRouter = Router();
const modeSchema = z.enum(["morning", "evening", "weekly", "alert"]);
const eventLimitSchema = z.coerce.number().int().min(1).max(200).optional();
const reliabilityLimitSchema = z.coerce.number().int().min(1).max(200).optional();
const briefingIdParamSchema = z.string().uuid();
const feedbackSchema = z.object({
  rating: z.union([z.literal(-1), z.literal(1)]),
  note: z.string().max(500).optional()
});

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
    `SELECT
       b.id,
       b.mode,
       b.script,
       b.audio_url AS "audioUrl",
       b.delivery_status AS "deliveryStatus",
       b.delivery_detail AS "deliveryDetail",
       b.delivered_at AS "deliveredAt",
       b.created_at AS "createdAt",
       bf.rating AS "feedbackRating",
       bf.note AS "feedbackNote"
     FROM briefings b
     LEFT JOIN briefing_feedback bf
       ON bf.briefing_id = b.id
      AND bf.user_id = b.user_id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC
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

briefingsRouter.get("/reliability-alerts", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedLimit = reliabilityLimitSchema.safeParse(req.query.limit);
  if (!parsedLimit.success && req.query.limit !== undefined) {
    res.status(400).json({ error: "Invalid limit query param" });
    return;
  }
  const alerts = await listReliabilityAlerts(req.user!.id, parsedLimit.data ?? 25);
  res.json(alerts);
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

briefingsRouter.post("/:id/feedback", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedId = briefingIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid briefing id" });
    return;
  }
  const parsedBody = feedbackSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid feedback payload" });
    return;
  }

  const ownership = await pool.query<{ id: string }>(
    `SELECT id FROM briefings WHERE id = $1 AND user_id = $2`,
    [parsedId.data, req.user!.id]
  );
  if (!ownership.rows[0]) {
    res.status(404).json({ error: "Briefing not found" });
    return;
  }

  await upsertBriefingFeedback({
    userId: req.user!.id,
    briefingId: parsedId.data,
    rating: parsedBody.data.rating,
    note: parsedBody.data.note
  });
  res.json({ saved: true });
});

briefingsRouter.post("/:id/regenerate", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedId = briefingIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid briefing id" });
    return;
  }
  const existing = await pool.query<{ mode: "morning" | "evening" | "weekly" | "alert" }>(
    `SELECT mode FROM briefings WHERE id = $1 AND user_id = $2`,
    [parsedId.data, req.user!.id]
  );
  const row = existing.rows[0];
  if (!row) {
    res.status(404).json({ error: "Briefing not found" });
    return;
  }

  const regenerated = await runBriefingPipeline(req.user!.id, row.mode);
  res.json(regenerated);
});

briefingsRouter.get("/jobs/schedule-preview", requireAuth, async (req: AuthenticatedRequest, res) => {
  const schedule = await getUserSchedule(req.user!.id);
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found for user" });
    return;
  }

  res.json({
    timezone: schedule.timezone || "UTC",
    morning: schedule.morningTime,
    evening: schedule.eveningTime,
    weekly: schedule.eveningTime,
    urgencyWatcherMinutes: 15
  });
});
