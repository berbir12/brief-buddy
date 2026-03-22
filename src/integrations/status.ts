export type IntegrationHealthStatus = "connected" | "error" | "reconnect_required" | "not_connected";

export interface IntegrationStatusInputRow {
  provider: string;
  status: IntegrationHealthStatus;
  expiresAt: Date | null;
  lastError: string | null;
  lastSyncedAt: Date | null;
}

export interface IntegrationStatusOutputRow {
  provider: string;
  connected: boolean;
  status: IntegrationHealthStatus;
  lastError: string | null;
  lastSyncedAt: string | null;
  requiresReconnect: boolean;
}

export function buildIntegrationStatusRows(
  rows: IntegrationStatusInputRow[],
  providers: readonly string[],
  now = Date.now()
): IntegrationStatusOutputRow[] {
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return providers.map((provider) => {
    const row = byProvider.get(provider);
    if (!row) {
      return {
        provider,
        connected: false,
        status: "not_connected",
        lastError: null,
        lastSyncedAt: null,
        requiresReconnect: false
      };
    }

    const tokenExpired = Boolean(row.expiresAt && row.expiresAt.getTime() <= now);
    const requiresReconnect = row.status === "reconnect_required" || tokenExpired;
    return {
      provider,
      connected: !requiresReconnect,
      status: requiresReconnect ? "reconnect_required" : row.status,
      lastError: row.lastError,
      lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
      requiresReconnect
    };
  });
}
