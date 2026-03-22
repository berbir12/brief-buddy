import { briefingQueue } from "./queue";
import { listUserSchedules } from "../db/queries";
import { dailyCronAt } from "./cron";

export async function registerMorningBriefingJob(): Promise<void> {
  const schedules = await listUserSchedules();
  await Promise.all(
    schedules.map((schedule) =>
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
      )
    )
  );
}
