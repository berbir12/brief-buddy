function splitTime(value: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: 7, minute: 0 };
  }
  return { hour, minute };
}

export function dailyCronAt(timeHHmm: string): string {
  const { hour, minute } = splitTime(timeHHmm);
  return `${minute} ${hour} * * *`;
}

export function weekdayCronAt(timeHHmm: string): string {
  const { hour, minute } = splitTime(timeHHmm);
  return `${minute} ${hour} * * 1-5`;
}

export function fridayCronAt(timeHHmm: string): string {
  const { hour, minute } = splitTime(timeHHmm);
  return `${minute} ${hour} * * 5`;
}
