import { WebClient } from "@slack/web-api";
import { getUserEmail } from "../db/queries";
import { getIntegrationToken } from "../integrations/tokens";
import { sendAlertEmail } from "./email";

export interface AlertPayload {
  userId: string;
  alertKey: string;
  severity: "warning" | "critical";
  message: string;
  source: string;
}

async function notifyViaSlack(userId: string, payload: AlertPayload): Promise<void> {
  const token = await getIntegrationToken(userId, "slack");
  if (!token) return;

  try {
    const slack = new WebClient(token.access_token);
    const auth = await slack.auth.test();
    const slackUserId = auth.user_id;
    if (!slackUserId) return;

    const dm = await slack.conversations.open({ users: slackUserId });
    const channelId = dm.channel?.id;
    if (!channelId) return;

    const icon = payload.severity === "critical" ? ":red_circle:" : ":warning:";
    await slack.chat.postMessage({
      channel: channelId,
      text: `${icon} *VoiceBrief ${payload.severity.toUpperCase()}* — ${payload.source}\n${payload.message}\n\nCheck your <${process.env.FRONTEND_URL ?? ""}/dashboard|dashboard> for details.`
    });
  } catch {
    // Slack notification failures are best-effort — never throw
  }
}

export async function sendAlertNotification(payload: AlertPayload): Promise<void> {
  const [email] = await Promise.all([getUserEmail(payload.userId)]);

  await Promise.allSettled([
    email
      ? sendAlertEmail({
          to: email,
          severity: payload.severity,
          message: payload.message,
          source: payload.source
        })
      : Promise.resolve(),
    notifyViaSlack(payload.userId, payload)
  ]);
}
