import dayjs from "dayjs";
import { fetchCalendarEvents } from "./calendarAgent";
import { fetchCrmDeals } from "./crmAgent";
import { fetchEmailInsights } from "./emailAgent";
import { fetchIndustryNews } from "./newsAgent";
import { fetchSlackMessages } from "./slackAgent";
import { env } from "../config/env";
import {
  saveBriefingRecord,
  getUserProfile,
  getUserSettings,
  markBriefingDelivered,
  canSendAlertNow
} from "../db/queries";
import { scorePriorities } from "../tasks/priorityScorer";
import { extractAndStoreTasks } from "../tasks/extractAndStore";
import { getTopOpenTasks } from "../tasks/taskStore";
import { writeBriefingScript } from "../voice/scriptWriter";
import { synthesizeSpeech } from "../voice/elevenLabs";
import { deliverBriefingCall } from "../voice/callDelivery";
import { BriefingPayload } from "../types/briefing";
import { withFallback } from "../utils/timeouts";

export async function runBriefingPipeline(
  userId: string,
  mode: "morning" | "evening" | "weekly" | "alert" = "morning"
): Promise<{ briefingId: string; script: string; audioUrl: string | null }> {
  if (mode === "alert") {
    const allowed = await canSendAlertNow(userId);
    if (!allowed) {
      return {
        briefingId: "rate-limited",
        script: "Alert skipped due to per-hour limit.",
        audioUrl: null
      };
    }
  }

  const settings = await getUserSettings(userId);
  const profile = await getUserProfile(userId);
  const failures: string[] = [];

  const [emails, calendar, slack, crmDeals, news] = await Promise.all([
    withFallback(
      async () => fetchEmailInsights(userId),
      [],
      "email-agent"
    ).then((data) => data),
    withFallback(
      async () => fetchCalendarEvents(userId, mode === "evening" ? "evening" : "morning"),
      [],
      "calendar-agent"
    ),
    withFallback(() => fetchSlackMessages(userId), [], "slack-agent"),
    withFallback(() => fetchCrmDeals(userId), [], "crm-agent"),
    env.ENABLE_NEWS_AGENT
      ? withFallback(() => fetchIndustryNews(settings.newsKeywords, settings.newsFeeds), [], "news-agent")
      : Promise.resolve([])
  ]);

  if (emails.length === 0) failures.push("Email source unavailable or empty.");
  if (calendar.length === 0) failures.push("Calendar source unavailable or empty.");

  await withFallback(() => extractAndStoreTasks(userId, emails, slack), 0, "extract-and-store-tasks");

  const scoredItems = scorePriorities({ emails, calendar, slack, crmDeals }, settings.dealValueThreshold, 3);
  if (mode === "alert" && !scoredItems.some((item) => item.priority === "CRITICAL")) {
    return {
      briefingId: "no-critical-items",
      script: "No critical items found.",
      audioUrl: null
    };
  }

  const payload: BriefingPayload = {
    date: dayjs().format("dddd, MMMM D"),
    mode,
    emails,
    calendar,
    slack,
    crmDeals,
    news,
    scoredItems,
    failures
  };

  const script = await writeBriefingScript(payload);
  const audioUrl = await withFallback(() => synthesizeSpeech(script, profile?.elevenLabsVoiceId ?? undefined), null, "elevenlabs");

  const briefingId = await saveBriefingRecord({
    userId,
    mode,
    script,
    audioUrl: audioUrl ?? undefined
  });

  const topTasks = await getTopOpenTasks(userId, 3);
  if (profile?.phone) {
    const delivery = await deliverBriefingCall(profile.phone, audioUrl, script, userId, briefingId, topTasks);
    if (delivery.status === "delivered") {
      await markBriefingDelivered(briefingId);
    }
  }

  return { briefingId, script, audioUrl };
}
