import twilio from "twilio";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { withTimeout } from "../utils/timeouts";

const twilioClient =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : null;

export interface TopTask {
  id: string;
  text: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildTwimlWithGather(
  userId: string,
  audioUrl: string,
  topTasks: TopTask[]
): string {
  const base = (env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const taskIds = topTasks.map((t) => t.id).join(",");
  const state = jwt.sign({ sub: userId, taskIds }, env.JWT_SECRET, { expiresIn: "30m" });
  const firstText = escapeXml(topTasks[0].text.slice(0, 200));
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${escapeXml(audioUrl)}</Play>
  <Say voice="alice">Your first task is: ${firstText}. Press 1 for done, 2 to snooze, 3 to forward.</Say>
  <Gather action="${base}/api/voice/gather?state=${encodeURIComponent(state)}&amp;index=0" numDigits="1" timeout="6">
    <Say voice="alice">Press 1 for done, 2 to snooze, 3 to forward.</Say>
  </Gather>
  <Say voice="alice">No input received. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

export async function deliverBriefingCall(
  toPhone: string,
  audioUrl: string | null,
  transcript: string,
  userId: string,
  _briefingId?: string,
  topTasks: TopTask[] = []
): Promise<{ status: "delivered" | "sms-fallback" | "skipped" | "failed"; sid?: string; detail?: string }> {
  const fromPhone = env.TWILIO_PHONE_NUMBER;
  if (!twilioClient || !fromPhone) {
    return { status: "skipped" };
  }

  if (!audioUrl) {
    try {
      await twilioClient.messages.create({
        to: toPhone,
        from: fromPhone,
        body: `VoiceBrief fallback transcript:\n\n${transcript}`
      });
      return { status: "sms-fallback" };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { status: "failed", detail: `SMS fallback failed: ${detail}` };
    }
  }

  const twiml =
    topTasks.length > 0
      ? buildTwimlWithGather(userId, audioUrl, topTasks)
      : `<?xml version="1.0" encoding="UTF-8"?><Response><Play>${escapeXml(audioUrl)}</Play><Hangup/></Response>`;

  try {
    const call = await withTimeout(
      twilioClient.calls.create({
        to: toPhone,
        from: fromPhone,
        twiml
      }),
      10_000,
      "twilio-call-delivery"
    );
    return { status: "delivered", sid: call.sid };
  } catch (error) {
    try {
      await twilioClient.messages.create({
        to: toPhone,
        from: fromPhone,
        body: `VoiceBrief fallback transcript:\n\n${transcript}`
      });
      return { status: "sms-fallback" };
    } catch (smsError) {
      const callDetail = error instanceof Error ? error.message : String(error);
      const smsDetail = smsError instanceof Error ? smsError.message : String(smsError);
      return { status: "failed", detail: `Call failed: ${callDetail}. SMS fallback failed: ${smsDetail}` };
    }
  }
}
