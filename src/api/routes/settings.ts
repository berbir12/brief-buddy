import { Router } from "express";
import { Client as HubspotClient } from "@hubspot/api-client";
import { google } from "googleapis";
import { WebClient } from "@slack/web-api";
import { z } from "zod";
import { disconnectIntegration, getIntegrationsStatus, getUserSettings, pool, upsertIntegration } from "../../db/queries";
import { fetchIndustryNews } from "../../agents/newsAgent";
import { getIntegrationToken, refreshGoogleTokenIfNeeded } from "../../integrations/tokens";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { registerSchedulesForUser } from "../../scheduler/registerUserSchedules";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);
const settingsPatchSchema = z.object({
  morningTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  eveningTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  newsKeywords: z.array(z.string()).optional(),
  newsFeeds: z.array(z.string().url()).optional(),
  dealValueThreshold: z.number().nonnegative().optional(),
  urgencyKeywords: z.array(z.string()).optional()
});
const profilePatchSchema = z.object({
  phone: z.union([z.literal(""), z.string().regex(/^\+[1-9]\d{7,14}$/), z.null()]).optional()
});
const providerSchema = z.enum(["google", "slack", "crm"]);
const integrationTestProviderSchema = z.enum(["google", "slack", "crm", "news"]);
const crmConnectSchema = z.object({
  apiKey: z.string().min(20).max(400)
});

settingsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const settings = await getUserSettings(req.user!.id);
  res.json(settings);
});

settingsRouter.get("/profile", async (req: AuthenticatedRequest, res) => {
  const result = await pool.query<{ phone: string | null; timezone: string }>(
    `SELECT phone, timezone FROM users WHERE id = $1`,
    [req.user!.id]
  );
  const row = result.rows[0];
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(row);
});

settingsRouter.get("/integrations", async (req: AuthenticatedRequest, res) => {
  const statuses = await getIntegrationsStatus(req.user!.id);
  res.json(statuses);
});

settingsRouter.get("/integrations/diagnostics", async (req: AuthenticatedRequest, res) => {
  const statuses = await getIntegrationsStatus(req.user!.id);
  res.json({
    generatedAt: new Date().toISOString(),
    integrations: statuses
  });
});

settingsRouter.put("/integrations/crm", async (req: AuthenticatedRequest, res) => {
  const parsed = crmConnectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid CRM payload. Provide a HubSpot private app token." });
    return;
  }

  await upsertIntegration({
    userId: req.user!.id,
    provider: "crm",
    accessToken: parsed.data.apiKey.trim(),
    refreshToken: null,
    expiresAt: null
  });

  const statuses = await getIntegrationsStatus(req.user!.id);
  res.json({ connected: true, integrations: statuses });
});

settingsRouter.delete("/integrations/:provider", async (req: AuthenticatedRequest, res) => {
  const parsed = providerSchema.safeParse(req.params.provider);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }
  const disconnected = await disconnectIntegration(req.user!.id, parsed.data);
  const statuses = await getIntegrationsStatus(req.user!.id);
  res.json({ disconnected, integrations: statuses });
});

settingsRouter.post("/integrations/:provider/test", async (req: AuthenticatedRequest, res) => {
  const parsed = integrationTestProviderSchema.safeParse(req.params.provider);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }
  const provider = parsed.data;
  const userId = req.user!.id;

  try {
    if (provider === "google") {
      const auth = await refreshGoogleTokenIfNeeded(userId);
      if (!auth) {
        res.status(400).json({ ok: false, provider, message: "Google is not connected or needs reconnect." });
        return;
      }

      const gmail = google.gmail({ version: "v1", auth });
      const calendar = google.calendar({ version: "v3", auth });
      await Promise.all([
        gmail.users.getProfile({ userId: "me" }),
        calendar.calendarList.list({ maxResults: 1 })
      ]);
      res.json({ ok: true, provider, message: "Google connection is healthy." });
      return;
    }

    if (provider === "slack") {
      const token = await getIntegrationToken(userId, "slack");
      if (!token) {
        res.status(400).json({ ok: false, provider, message: "Slack is not connected." });
        return;
      }
      const slack = new WebClient(token.access_token);
      const authTest = await slack.auth.test();
      if (!authTest.ok) {
        res.status(400).json({ ok: false, provider, message: "Slack auth check failed." });
        return;
      }
      res.json({ ok: true, provider, message: "Slack connection is healthy." });
      return;
    }

    if (provider === "crm") {
      const token = await getIntegrationToken(userId, "crm");
      if (!token) {
        res.status(400).json({ ok: false, provider, message: "HubSpot is not connected." });
        return;
      }
      const client = new HubspotClient({ accessToken: token.access_token });
      await client.crm.contacts.basicApi.getPage(1);
      res.json({ ok: true, provider, message: "HubSpot connection is healthy." });
      return;
    }

    const settings = await getUserSettings(userId);
    const stories = await fetchIndustryNews(settings.newsKeywords, settings.newsFeeds);
    res.json({
      ok: true,
      provider,
      message: `Fetched ${stories.length} relevant stories from RSS feeds.`,
      fetchedCount: stories.length
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, provider, message: detail });
  }
});

settingsRouter.patch("/", async (req: AuthenticatedRequest, res) => {
  const parsed = settingsPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings payload" });
    return;
  }

  await pool.query(
    `UPDATE settings
        SET morning_time = COALESCE($2, morning_time),
            evening_time = COALESCE($3, evening_time),
            news_keywords = COALESCE($4, news_keywords),
            news_feeds = COALESCE($5, news_feeds),
            deal_value_threshold = COALESCE($6, deal_value_threshold),
            urgency_keywords = COALESCE($7, urgency_keywords),
            updated_at = NOW()
      WHERE user_id = $1`,
    [
      req.user!.id,
      parsed.data.morningTime ?? null,
      parsed.data.eveningTime ?? null,
      parsed.data.newsKeywords ?? null,
      parsed.data.newsFeeds ?? null,
      parsed.data.dealValueThreshold ?? null,
      parsed.data.urgencyKeywords ?? null
    ]
  );
  await registerSchedulesForUser(req.user!.id);
  const settings = await getUserSettings(req.user!.id);
  res.json(settings);
});

settingsRouter.patch("/profile", async (req: AuthenticatedRequest, res) => {
  const parsed = profilePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile payload" });
    return;
  }

  const normalizedPhone =
    parsed.data.phone === undefined || parsed.data.phone === null || parsed.data.phone.trim() === ""
      ? null
      : parsed.data.phone.trim();

  const updated = await pool.query<{ phone: string | null; timezone: string }>(
    `UPDATE users
        SET phone = $2
      WHERE id = $1
      RETURNING phone, timezone`,
    [req.user!.id, normalizedPhone]
  );
  if (!updated.rows[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(updated.rows[0]);
});
