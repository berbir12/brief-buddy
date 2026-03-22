import { briefingQueue } from "./queue";
import { listUserSchedules } from "../db/queries";
import { fridayCronAt } from "./cron";

export async function registerWeeklyRecapJob(): Promise<void> {
  const schedules = await listUserSchedules();
  await Promise.all(
    schedules.map((schedule) =>
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
      )
    )
  );
}
