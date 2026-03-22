import { gmail_v1, google } from "googleapis";
import { EmailInsight } from "../types/briefing";
import { refreshGoogleTokenIfNeeded } from "../integrations/tokens";
import { markIntegrationSyncFailure, markIntegrationSyncSuccess } from "../db/queries";
import { normalizeIntegrationError } from "../integrations/errors";
import { withTimeout } from "../utils/timeouts";

const URGENCY_KEYWORDS = ["urgent", "asap", "invoice", "contract", "today", "deadline"];
const AUTOMATED_HINTS = ["no-reply", "noreply", "newsletter", "digest", "notification"];

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function summarizeBody(snippet: string, body: string): string {
  const text = (body || snippet || "").replace(/\s+/g, " ").trim();
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function calcUrgencyScore(sender: string, subject: string, content: string): number {
  const text = `${subject} ${content}`.toLowerCase();
  let score = 0;
  for (const keyword of URGENCY_KEYWORDS) {
    if (text.includes(keyword)) score += 2;
  }
  if (!sender.toLowerCase().includes("no-reply") && !sender.toLowerCase().includes("newsletter")) {
    score += 1;
  }
  return Math.min(10, score);
}

function isAutomatedOrNewsletter(from: string, subject: string): boolean {
  const combined = `${from} ${subject}`.toLowerCase();
  return AUTOMATED_HINTS.some((hint) => combined.includes(hint));
}

export async function fetchEmailInsights(userId: string): Promise<EmailInsight[]> {
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
        const gmail = google.gmail({ version: "v1", auth });
        const afterUnix = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
        const list = await gmail.users.messages.list({
          userId: "me",
          q: `is:unread after:${afterUnix}`,
          maxResults: 40
        });

        const messages = list.data.messages ?? [];
        if (messages.length === 0) {
          await markIntegrationSyncSuccess(userId, "google");
          return [];
        }

        const details = await Promise.all(
          messages.map((m) =>
            gmail.users.messages.get({
              userId: "me",
              id: m.id as string,
              format: "full"
            })
          )
        );

        const insights: EmailInsight[] = [];

        for (const detail of details) {
          const msg = detail.data;
          const headers = msg.payload?.headers ?? [];
          const sender = headerValue(headers, "From");
          const subject = headerValue(headers, "Subject");
          if (isAutomatedOrNewsletter(sender, subject)) {
            continue;
          }

          const plainBody = msg.payload?.parts?.find((p) => p.mimeType === "text/plain")?.body?.data;
          const body = plainBody ? decodeBase64Url(plainBody) : "";
          const summary = summarizeBody(msg.snippet ?? "", body);
          const urgencyScore = calcUrgencyScore(sender, subject, summary);

          insights.push({
            sender,
            subject: subject || "(No subject)",
            summary,
            urgencyScore,
            requiresAction: urgencyScore >= 4
          });
        }

        await markIntegrationSyncSuccess(userId, "google");
        return insights;
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
    "email-agent"
  );
}
