import { Client } from "@hubspot/api-client";
import { CrmDeal } from "../types/briefing";
import { env } from "../config/env";
import { getIntegrationToken } from "../integrations/tokens";
import { withTimeout } from "../utils/timeouts";

const STAGES = new Set(["proposal sent", "negotiation", "closing"]);

export async function fetchCrmDeals(userId: string): Promise<CrmDeal[]> {
  const crmIntegration = await getIntegrationToken(userId, "crm");
  const accessToken = crmIntegration?.access_token ?? env.HUBSPOT_API_KEY;
  if (!accessToken) return [];
  if (!env.ENABLE_CRM_AGENT && !crmIntegration) return [];

  try {
    return await withTimeout(
      (async () => {
        const client = new Client({ accessToken });

        const pipelineResponse = await client.crm.pipelines.pipelinesApi.getAll("deals");
        const stageMap = new Map<string, string>();
        for (const pipeline of pipelineResponse.results ?? []) {
          for (const stage of pipeline.stages ?? []) {
            if (stage.id && stage.label) {
              stageMap.set(stage.id, stage.label.toLowerCase());
            }
          }
        }

        const page = await client.crm.deals.basicApi.getPage(100, undefined, [
          "dealname",
          "dealstage",
          "amount",
          "hs_lastactivitydate",
          "hs_lastmodifieddate"
        ]);
        const now = Date.now();

        return (page.results ?? [])
          .map((deal) => {
            const rawStage = deal.properties?.dealstage ?? "";
            const stage = (stageMap.get(rawStage) ?? rawStage).toLowerCase();
            const value = Number(deal.properties?.amount ?? 0);
            const lastActivity = Number(deal.properties?.hs_lastactivitydate ?? deal.properties?.hs_lastmodifieddate ?? now);
            const safeLastActivity = Number.isFinite(lastActivity) ? lastActivity : now;
            const daysSinceActivity = Math.floor((now - safeLastActivity) / (1000 * 60 * 60 * 24));
            return {
              dealName: deal.properties?.dealname ?? "Unnamed deal",
              stage,
              value,
              contactName: "Unknown contact",
              daysSinceActivity
            };
          })
          .filter((d) => STAGES.has(d.stage));
      })(),
      10_000,
      "crm-agent"
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (reason.includes("401") || reason.toLowerCase().includes("authentication")) {
      console.warn("[crm-agent] authentication failed; returning no deals.");
      return [];
    }
    throw error;
  }
}
