import dayjs from "dayjs";
import { google } from "googleapis";
import { CalendarEvent } from "../types/briefing";
import { markIntegrationSyncFailure, markIntegrationSyncSuccess } from "../db/queries";
import { normalizeIntegrationError } from "../integrations/errors";
import { refreshGoogleTokenIfNeeded } from "../integrations/tokens";
import { withTimeout } from "../utils/timeouts";

function parseAttendees(attendees: { email?: string | null }[] | undefined): string[] {
  return (attendees ?? []).map((a) => a.email ?? "").filter(Boolean);
}

function isExternalMeeting(attendees: string[]): boolean {
  if (attendees.length === 0) return false;
  const domains = attendees.map((email) => email.split("@")[1]).filter(Boolean);
  return new Set(domains).size > 1;
}

export async function fetchCalendarEvents(userId: string, mode: "morning" | "evening" = "morning"): Promise<CalendarEvent[]> {
  return withTimeout(
    (async () => {
      const auth = await refreshGoogleTokenIfNeeded(userId);
      if (!auth) {
        const normalized = normalizeIntegrationError("google", "integration unavailable");
        await markIntegrationSyncFailure({
          userId,
          provider: "google",
          error: normalized.message,
          requiresReconnect: true
        });
        return [];
      }

      try {
        const calendar = google.calendar({ version: "v3", auth });
        const baseDay = mode === "evening" ? dayjs().add(1, "day") : dayjs();
        const timeMin = baseDay.startOf("day").toISOString();
        const timeMax = baseDay.endOf("day").toISOString();

        const events = await calendar.events.list({
          calendarId: "primary",
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 25
        });

        const mapped = (events.data.items ?? []).map((event) => {
          const attendees = parseAttendees(event.attendees as { email?: string | null }[] | undefined);
          return {
            title: event.summary ?? "Untitled event",
            time: event.start?.dateTime ?? event.start?.date ?? "TBD",
            attendees,
            location: event.location ?? null,
            isExternal: isExternalMeeting(attendees)
          };
        });
        await markIntegrationSyncSuccess(userId, "google");
        return mapped;
      } catch (error) {
        const normalized = normalizeIntegrationError("google", error);
        await markIntegrationSyncFailure({
          userId,
          provider: "google",
          error: normalized.message,
          requiresReconnect: normalized.requiresReconnect
        });
        throw error;
      }
    })(),
    10_000,
    "calendar-agent"
  );
}
