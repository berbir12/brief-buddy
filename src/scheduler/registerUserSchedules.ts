import { getUserSchedule } from "../db/queries";
import { dailyCronAt, fridayCronAt, weekdayCronAt } from "./cron";
import { briefingQueue } from "./queue";

export async function registerSchedulesForUser(userId: string): Promise<void> {
  const schedule = await getUserSchedule(userId);
  if (!schedule) return;

  await Promise.all([
    briefingQueue.upsertJobScheduler(
      `morning-briefing-${schedule.userId}`,
      {
        pattern: dailyCronAt(schedule.morningTime),
        tz: schedule.timezone || "UTC"
      },
      {
        name: "morning-briefing",
        data: { userId: schedule.userId, mode: "morning" }
      }
    ),
    briefingQueue.upsertJobScheduler(
      `evening-wrapup-${schedule.userId}`,
      {
        pattern: weekdayCronAt(schedule.eveningTime),
        tz: schedule.timezone || "UTC"
      },
      {
        name: "evening-wrapup",
        data: { userId: schedule.userId, mode: "evening" }
      }
    ),
    briefingQueue.upsertJobScheduler(
      `weekly-recap-${schedule.userId}`,
      {
        pattern: fridayCronAt(schedule.eveningTime),
        tz: schedule.timezone || "UTC"
      },
      {
        name: "weekly-recap",
        data: { userId: schedule.userId, mode: "weekly" }
      }
    ),
    briefingQueue.upsertJobScheduler(
      `urgency-watcher-${schedule.userId}`,
      { every: 15 * 60 * 1000 },
      {
        name: "urgency-watcher",
        data: { userId: schedule.userId, mode: "alert" }
      }
    )
  ]);
}
