import { Router } from "express";
import { z } from "zod";
import { disconnectIntegration, getIntegrationsStatus, getUserSettings, pool } from "../../db/queries";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { registerSchedulesForUser } from "../../scheduler/registerUserSchedules";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);
const settingsPatchSchema = z.object({
  morningTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  eveningTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  newsKeywords: z.array(z.string()).optional(),
  dealValueThreshold: z.number().nonnegative().optional(),
  urgencyKeywords: z.array(z.string()).optional()
});
const providerSchema = z.enum(["google", "slack", "crm"]);

settingsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const settings = await getUserSettings(req.user!.id);
  res.json(settings);
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

settingsRouter.delete("/integrations/:provider", async (req: AuthenticatedRequest, res) => {
  const parsed = providerSchema.safeParse(req.params.provider);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }
  if (parsed.data === "crm") {
    res.status(400).json({ error: "CRM integration cannot be disconnected yet." });
    return;
  }
  const disconnected = await disconnectIntegration(req.user!.id, parsed.data);
  const statuses = await getIntegrationsStatus(req.user!.id);
  res.json({ disconnected, integrations: statuses });
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
            deal_value_threshold = COALESCE($5, deal_value_threshold),
            urgency_keywords = COALESCE($6, urgency_keywords),
            updated_at = NOW()
      WHERE user_id = $1`,
    [
      req.user!.id,
      parsed.data.morningTime ?? null,
      parsed.data.eveningTime ?? null,
      parsed.data.newsKeywords ?? null,
      parsed.data.dealValueThreshold ?? null,
      parsed.data.urgencyKeywords ?? null
    ]
  );
  await registerSchedulesForUser(req.user!.id);
  const settings = await getUserSettings(req.user!.id);
  res.json(settings);
});
