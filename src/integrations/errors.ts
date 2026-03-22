type Provider = "google" | "slack";

export function normalizeIntegrationError(provider: Provider, error: unknown): {
  message: string;
  requiresReconnect: boolean;
} {
  const raw = (error instanceof Error ? error.message : String(error ?? "Unknown error")).trim();
  const lower = raw.toLowerCase();

  if (provider === "google") {
    if (/invalid_grant|invalid_client|revoked|reauth|consent|insufficient_permission|unauthorized_client/.test(lower)) {
      return { message: "Google connection expired or was revoked. Reconnect Google.", requiresReconnect: true };
    }
    if (/401|403|unauthorized|forbidden/.test(lower)) {
      return { message: "Google rejected access. Reconnect and grant required scopes.", requiresReconnect: true };
    }
    if (/timeout|etimedout|econnreset|network|socket/.test(lower)) {
      return { message: "Google sync timed out. We will retry automatically.", requiresReconnect: false };
    }
    return { message: "Google sync failed. Please retry.", requiresReconnect: false };
  }

  if (/invalid_auth|not_authed|token_revoked|account_inactive|missing_scope/.test(lower)) {
    return { message: "Slack connection is invalid or missing scopes. Reconnect Slack.", requiresReconnect: true };
  }
  if (/401|403|unauthorized|forbidden/.test(lower)) {
    return { message: "Slack rejected access. Reconnect and grant required scopes.", requiresReconnect: true };
  }
  if (/timeout|etimedout|econnreset|network|socket/.test(lower)) {
    return { message: "Slack sync timed out. We will retry automatically.", requiresReconnect: false };
  }
  return { message: "Slack sync failed. Please retry.", requiresReconnect: false };
}
