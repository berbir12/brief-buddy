import { WebClient } from "@slack/web-api";
import { SlackMessage } from "../types/briefing";
import { getIntegrationToken } from "../integrations/tokens";
import { markIntegrationSyncFailure, markIntegrationSyncSuccess } from "../db/queries";
import { normalizeIntegrationError } from "../integrations/errors";
import { withFallback, withTimeout } from "../utils/timeouts";

const URGENCY_REGEX = /(urgent|asap|invoice|contract|blocker|critical)/i;

function scoreSlackUrgency(text: string, from: string): number {
  let score = 3;
  if (URGENCY_REGEX.test(text)) score += 4;
  if (/owner|manager|ceo|founder/i.test(from)) score += 3;
  return Math.min(10, score);
}

export async function fetchSlackMessages(userId: string): Promise<SlackMessage[]> {
  return withFallback(
    () =>
      withTimeout(
        (async () => {
          const token = await getIntegrationToken(userId, "slack");
          if (!token) {
            const normalized = normalizeIntegrationError("slack", "not connected");
            await markIntegrationSyncFailure({
              userId,
              provider: "slack",
              error: normalized.message,
              requiresReconnect: true
            });
            return [];
          }

          try {
            const slack = new WebClient(token.access_token);
            const self = await slack.auth.test();
            const mySlackUserId = self.user_id ?? "";
            const oldest = String(Math.floor(Date.now() / 1000) - 24 * 60 * 60);
            const conversations = await slack.conversations.list({
              types: "im,public_channel,private_channel",
              exclude_archived: true,
              limit: 100
            });
            const channels = conversations.channels ?? [];
            const messages: SlackMessage[] = [];
            const userNameCache = new Map<string, string>();

            const resolveUserName = async (slackUserId: string): Promise<string> => {
              if (!slackUserId) return "unknown";
              if (userNameCache.has(slackUserId)) return userNameCache.get(slackUserId)!;
              const info = await slack.users.info({ user: slackUserId });
              const name = info.user?.real_name || info.user?.name || slackUserId;
              userNameCache.set(slackUserId, name);
              return name;
            };

            for (const channel of channels) {
              const unread = Number(
                (channel as { unread_count?: number; unread_count_display?: number }).unread_count ??
                  (channel as { unread_count_display?: number }).unread_count_display ??
                  0
              );
              if (unread > 50 || !channel.id) continue;

              const history = await slack.conversations.history({
                channel: channel.id,
                limit: 50,
                oldest,
                inclusive: true
              });

              for (const item of history.messages ?? []) {
                if (!item.text || !item.ts || !item.user) continue;
                const isDm = Boolean(channel.is_im);
                const isMention = mySlackUserId ? item.text.includes(`<@${mySlackUserId}>`) : false;
                if (!isDm && !isMention) continue;

                const from = await resolveUserName(item.user);
                const urgencyScore = scoreSlackUrgency(item.text, from);
                messages.push({
                  from,
                  channel: channel.name ?? channel.id,
                  message: item.text,
                  urgencyScore
                });
              }
            }

            await markIntegrationSyncSuccess(userId, "slack");
            return messages;
          } catch (error) {
            const normalized = normalizeIntegrationError("slack", error);
            await markIntegrationSyncFailure({
              userId,
              provider: "slack",
              error: normalized.message,
              requiresReconnect: normalized.requiresReconnect
            });
            throw error;
          }
        })(),
        10_000,
        "slack-agent"
      ),
    [],
    "slack-agent"
  );
}
