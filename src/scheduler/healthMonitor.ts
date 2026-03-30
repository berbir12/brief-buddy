import {
  createReliabilityAlertIfNeeded,
  getBriefingMetrics,
  getIntegrationsStatus,
  listBriefingJobEvents,
  listUserIds
} from "../db/queries";
import { sendAlertNotification } from "../notifications/alertNotifier";
import { briefingQueue } from "./queue";

function isRecent(isoDate: string, maxAgeMs: number): boolean {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= maxAgeMs;
}

async function raiseAlert(input: {
  userId: string;
  alertKey: string;
  severity: "warning" | "critical";
  message: string;
  source: string;
  dedupeMinutes: number;
}): Promise<void> {
  const isNew = await createReliabilityAlertIfNeeded(input);
  if (isNew) {
    await sendAlertNotification({
      userId: input.userId,
      alertKey: input.alertKey,
      severity: input.severity,
      message: input.message,
      source: input.source
    });
  }
}

export async function runReliabilityHealthChecks(): Promise<void> {
  const userIds = await listUserIds();
  for (const userId of userIds) {
    const [integrations, metrics, events] = await Promise.all([
      getIntegrationsStatus(userId),
      getBriefingMetrics(userId),
      listBriefingJobEvents(userId, 120)
    ]);

    for (const integration of integrations) {
      if (integration.requiresReconnect) {
        await raiseAlert({
          userId,
          alertKey: `reconnect-${integration.provider}`,
          source: "integrations",
          severity: "warning",
          message: `${integration.provider} needs reconnect to keep briefings accurate.`,
          dedupeMinutes: 360
        });
      }
    }

    const failedLast6h = events.filter(
      (event) => event.eventType === "failed" && isRecent(event.createdAt, 6 * 60 * 60 * 1000)
    ).length;
    if (failedLast6h >= 3) {
      await raiseAlert({
        userId,
        alertKey: "job-failures-6h",
        source: "worker",
        severity: "critical",
        message: `${failedLast6h} briefing jobs failed in the last 6 hours.`,
        dedupeMinutes: 120
      });
    }

    if (metrics.undelivered7d >= 3) {
      await raiseAlert({
        userId,
        alertKey: "undelivered-7d",
        source: "delivery",
        severity: "warning",
        message: `${metrics.undelivered7d} briefings were undelivered in the last 7 days.`,
        dedupeMinutes: 240
      });
    }

    const [waitingJobs, delayedJobs] = await Promise.all([
      briefingQueue.getJobs(["waiting"], 0, 500),
      briefingQueue.getJobs(["delayed"], 0, 500)
    ]);
    const backlog = [...waitingJobs, ...delayedJobs].filter((job) => String(job.data?.userId ?? "") === userId).length;
    if (backlog >= 10) {
      await raiseAlert({
        userId,
        alertKey: "queue-backlog",
        source: "queue",
        severity: "critical",
        message: `Queue backlog is high (${backlog} waiting/delayed jobs).`,
        dedupeMinutes: 60
      });
    }
  }
}
