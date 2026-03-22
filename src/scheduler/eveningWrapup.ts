import { briefingQueue } from "./queue";
import { listUserSchedules } from "../db/queries";
import { weekdayCronAt } from "./cron";

export async function registerEveningWrapupJob(): Promise<void> {
  const schedules = await listUserSchedules();
  await Promise.all(
    schedules.map((schedule) =>
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
      )
    )
  );
}
