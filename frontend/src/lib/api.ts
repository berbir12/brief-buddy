/**
 * VoiceBrief API client. Uses Vite proxy in dev: /api -> backend (e.g. localhost:3000).
 * In production set VITE_API_BASE or serve frontend and API on same origin.
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function getToken(): string | null {
  return localStorage.getItem("voicebrief_token");
}

export function setToken(token: string): void {
  localStorage.setItem("voicebrief_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("voicebrief_token");
  localStorage.removeItem("voicebrief_userId");
  localStorage.removeItem("voicebrief_userEmail");
  localStorage.removeItem("voicebrief_userEmailVerified");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent("voicebrief:auth-expired"));
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

// Auth
export function getDemoToken(): Promise<{ token: string; userId: string }> {
  return api<{ token: string; userId: string }>("/api/auth/demo-token");
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

export function register(body: { email: string; password: string }): Promise<{
  token: string;
  user: AuthUser;
  requiresEmailVerification?: boolean;
}> {
  return api<{
    token: string;
    user: AuthUser;
    requiresEmailVerification?: boolean;
  }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function loginWithPassword(body: { email: string; password: string }): Promise<{ token: string; user: AuthUser }> {
  return api<{ token: string; user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getMe(): Promise<{ user: AuthUser }> {
  return api<{ user: AuthUser }>("/api/auth/me");
}

export function logoutRequest(): Promise<void> {
  return api<void>("/api/auth/logout", { method: "POST" });
}

export function requestEmailVerification(): Promise<{ sent: boolean; alreadyVerified?: boolean }> {
  return api<{ sent: boolean; alreadyVerified?: boolean }>("/api/auth/verification/request", {
    method: "POST",
  });
}

export function verifyEmailToken(token: string): Promise<{ verified: boolean }> {
  return api<{ verified: boolean }>("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function getOAuthStartUrl(provider: "google" | "slack"): Promise<{ url: string }> {
  return api<{ url: string }>(`/api/auth/${provider}/start`);
}

// Briefings
export interface BriefingRow {
  id: string;
  mode: string;
  script: string;
  audioUrl: string | null;
  deliveryStatus: string;
  deliveredAt: string | null;
  createdAt: string;
}

export function getBriefingsHistory(): Promise<BriefingRow[]> {
  return api<BriefingRow[]>("/api/briefings/history");
}

export function triggerBriefing(mode: string): Promise<{ briefingId: string; script: string; audioUrl: string | null }> {
  return api("/api/briefings/trigger", {
    method: "POST",
    body: JSON.stringify({ mode: mode || "morning" }),
  });
}

// Tasks
export interface TaskRow {
  id: string;
  userId: string;
  text: string;
  source: string;
  priority: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

export function getTasks(): Promise<TaskRow[]> {
  return api<TaskRow[]>("/api/tasks");
}

export function createTask(body: {
  text: string;
  source?: string;
  priority?: string;
  dueDate?: string | null;
}): Promise<TaskRow> {
  return api<TaskRow>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateTask(
  id: string,
  body: Partial<{ text: string; priority: string; dueDate: string | null; status: string }>
): Promise<TaskRow> {
  return api<TaskRow>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteTask(id: string): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/api/tasks/${id}`, { method: "DELETE" });
}

// Settings
export interface SettingsRow {
  morningTime: string;
  eveningTime: string;
  newsKeywords: string[];
  dealValueThreshold: number;
  urgencyKeywords: string[];
}

export function getSettings(): Promise<SettingsRow> {
  return api<SettingsRow>("/api/settings");
}

export function updateSettings(body: Partial<SettingsRow>): Promise<SettingsRow> {
  return api<SettingsRow>("/api/settings", { method: "PATCH", body: JSON.stringify(body) });
}

export interface IntegrationStatus {
  provider: string;
  connected: boolean;
  status: "connected" | "error" | "reconnect_required" | "not_connected";
  lastError: string | null;
  lastSyncedAt: string | null;
  requiresReconnect: boolean;
}

export function getIntegrations(): Promise<IntegrationStatus[]> {
  return api<IntegrationStatus[]>("/api/settings/integrations");
}

export function getIntegrationsDiagnostics(): Promise<{ generatedAt: string; integrations: IntegrationStatus[] }> {
  return api<{ generatedAt: string; integrations: IntegrationStatus[] }>("/api/settings/integrations/diagnostics");
}

export function disconnectIntegration(provider: "google" | "slack"): Promise<{ disconnected: boolean; integrations: IntegrationStatus[] }> {
  return api<{ disconnected: boolean; integrations: IntegrationStatus[] }>(`/api/settings/integrations/${provider}`, {
    method: "DELETE",
  });
}

export interface BriefingMetrics {
  generated7d: number;
  delivered7d: number;
  undelivered7d: number;
  alerts7d: number;
  lastBriefingAt: string | null;
  deliveryRate7d: number;
}

export interface BriefingJobEvent {
  id: string;
  jobId: string;
  mode: string;
  eventType: string;
  detail: string | null;
  createdAt: string;
}

export function getBriefingMetrics(): Promise<BriefingMetrics> {
  return api<BriefingMetrics>("/api/briefings/metrics");
}

export function getBriefingJobEvents(limit = 50): Promise<BriefingJobEvent[]> {
  return api<BriefingJobEvent[]>(`/api/briefings/jobs/events?limit=${encodeURIComponent(String(limit))}`);
}

export interface SystemHealth {
  generatedAt: string;
  metrics: BriefingMetrics;
  queue: {
    waiting: number;
    active: number;
    delayed: number;
    completedRecent: number;
    failedRecent: number;
  };
  integrations: IntegrationStatus[];
  warnings: string[];
}

export function getSystemHealth(): Promise<SystemHealth> {
  return api<SystemHealth>("/api/briefings/system-health");
}
