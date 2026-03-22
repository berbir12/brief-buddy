import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  disconnectIntegration,
  getBriefingJobEvents,
  getIntegrationsDiagnostics,
  getOAuthStartUrl,
  getSettings,
  getSystemHealth,
  updateSettings
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const tabs = ["Briefing Schedule", "Voice", "Integrations", "Urgency Rules", "Operations"];

const voices = ["Rachel (Default)", "Marcus (Deep)", "Sofia (Warm)", "Alex (Neutral)"];

function formatLastSync(lastSyncedAt: string | null): string | null {
  if (!lastSyncedAt) return null;
  const date = new Date(lastSyncedAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Synced ${date.toLocaleString()}`;
}

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [morningTime, setMorningTime] = useState("07:00");
  const [eveningTime, setEveningTime] = useState("18:00");
  const [selectedVoice, setSelectedVoice] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [briefingLength, setBriefingLength] = useState("standard");
  const [newsKeywords, setNewsKeywords] = useState("");
  const [urgencyKeywords, setUrgencyKeywords] = useState("");
  const [dealValueThreshold, setDealValueThreshold] = useState(10000);

  const queryClient = useQueryClient();
  const [connectingProvider, setConnectingProvider] = useState<"google" | "slack" | null>(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState<"google" | "slack" | null>(null);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [verificationInfo, setVerificationInfo] = useState<string | null>(null);
  const { emailVerified, resendVerification } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const { data: integrationDiagnostics } = useQuery({
    queryKey: ["integrations", "diagnostics"],
    queryFn: getIntegrationsDiagnostics,
    refetchInterval: 60_000,
  });
  const integrations = integrationDiagnostics?.integrations ?? [];

  const { data: systemHealth, isLoading: systemHealthLoading } = useQuery({
    queryKey: ["system-health"],
    queryFn: getSystemHealth,
    refetchInterval: 60_000,
  });

  const { data: jobEvents = [], isLoading: jobEventsLoading } = useQuery({
    queryKey: ["briefing-job-events", "settings"],
    queryFn: () => getBriefingJobEvents(15),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (settings) {
      setMorningTime(settings.morningTime);
      setEveningTime(settings.eveningTime);
      setNewsKeywords(settings.newsKeywords?.join(", ") ?? "");
      setUrgencyKeywords(settings.urgencyKeywords?.join(", ") ?? "");
      setDealValueThreshold(settings.dealValueThreshold ?? 10000);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (payload: {
      morningTime?: string;
      eveningTime?: string;
      newsKeywords?: string[];
      urgencyKeywords?: string[];
      dealValueThreshold?: number;
    }) => updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const saveSchedule = () => {
    updateMutation.mutate({ morningTime, eveningTime });
  };

  const saveUrgencyRules = () => {
    updateMutation.mutate({
      newsKeywords: newsKeywords.split(",").map((k) => k.trim()).filter(Boolean),
      urgencyKeywords: urgencyKeywords.split(",").map((k) => k.trim()).filter(Boolean),
      dealValueThreshold,
    });
  };

  const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={cn(
        "w-10 h-6 rounded-full transition-colors flex items-center px-0.5",
        enabled ? "bg-primary" : "bg-muted-foreground/20"
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full bg-foreground transition-transform",
          enabled ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );

  const integrationList = [
    {
      name: "Gmail",
      icon: "📧",
      status: integrations.find((i) => i.provider === "google"),
      provider: "google" as const,
    },
    {
      name: "Google Calendar",
      icon: "📅",
      status: integrations.find((i) => i.provider === "google"),
      provider: "google" as const,
    },
    {
      name: "Slack",
      icon: "💬",
      status: integrations.find((i) => i.provider === "slack"),
      provider: "slack" as const,
    },
    { name: "HubSpot", icon: "🟠", status: null, provider: "crm" as const, comingSoon: true },
  ];

  const connectIntegration = async (provider: "google" | "slack") => {
    setIntegrationError(null);
    setConnectingProvider(provider);
    try {
      const { url } = await getOAuthStartUrl(provider);
      window.location.assign(url);
    } catch (error) {
      setIntegrationError(error instanceof Error ? error.message : "Unable to connect integration.");
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (provider: "google" | "slack") => {
    setIntegrationError(null);
    setDisconnectingProvider(provider);
    try {
      await disconnectIntegration(provider);
      await queryClient.invalidateQueries({ queryKey: ["integrations", "diagnostics"] });
    } catch (error) {
      setIntegrationError(error instanceof Error ? error.message : "Unable to disconnect integration.");
    } finally {
      setDisconnectingProvider(null);
    }
  };

  const handleResendVerification = async () => {
    setVerificationInfo(null);
    setIntegrationError(null);
    try {
      const result = await resendVerification();
      if (result.alreadyVerified) {
        setVerificationInfo("Email is already verified.");
      } else {
        setVerificationInfo("Verification email sent. Check your inbox.");
      }
    } catch (error) {
      setIntegrationError(error instanceof Error ? error.message : "Unable to resend verification email.");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">Configure your briefing preferences.</p>

      <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTab(i)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === i ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {activeTab === 0 && (
          <>
            <div className="card-surface p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Morning Briefing</p>
                  <p className="text-xs text-muted-foreground">Daily call with your full day summary</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={morningTime}
                    onChange={(e) => setMorningTime(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
                  />
                  <Toggle enabled={true} onToggle={() => {}} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Evening Wrap-up</p>
                  <p className="text-xs text-muted-foreground">End-of-day recap and tomorrow&apos;s prep</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={eveningTime}
                    onChange={(e) => setEveningTime(e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
                  />
                  <Toggle enabled={true} onToggle={() => {}} />
                </div>
              </div>
              <button
                onClick={saveSchedule}
                disabled={updateMutation.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {updateMutation.isPending ? "Saving…" : "Save schedule"}
              </button>
            </div>
            <div className="card-surface p-6 space-y-4">
              <p className="text-sm font-medium text-foreground">Phone Number</p>
              <p className="text-xs text-muted-foreground">Set in backend (demo user). Production: add phone field to profile.</p>
            </div>
          </>
        )}

        {activeTab === 1 && (
          <>
            <div className="card-surface p-6 space-y-4">
              <p className="text-sm font-medium text-foreground">Voice Selection</p>
              <div className="space-y-2">
                {voices.map((v, i) => (
                  <button
                    key={v}
                    onClick={() => setSelectedVoice(i)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg text-sm transition-colors",
                      selectedVoice === i
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-secondary text-foreground hover:bg-card-hover"
                    )}
                  >
                    <span>{v}</span>
                    <span className="text-xs text-muted-foreground">▶ Preview</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="card-surface p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Speed</p>
                <span className="text-sm text-muted-foreground">{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <p className="text-sm font-medium text-foreground mt-4">Briefing Length</p>
              <div className="flex gap-2">
                {[
                  { v: "short", l: "Short (60s)" },
                  { v: "standard", l: "Standard (90s)" },
                  { v: "detailed", l: "Detailed (2min)" },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setBriefingLength(o.v)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                      briefingLength === o.v
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-secondary text-foreground"
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 2 && (
          <div className="space-y-3">
            {!emailVerified && (
              <div className="card-surface p-4">
                <p className="text-sm font-medium text-foreground">Verify your email to connect integrations</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Google and Slack connections are blocked until your account email is verified.
                </p>
                <button
                  onClick={() => void handleResendVerification()}
                  className="mt-3 text-xs font-medium px-3 py-1.5 rounded-full bg-accent text-accent-foreground hover:brightness-110"
                >
                  Resend verification email
                </button>
                {verificationInfo ? <p className="text-xs text-muted-foreground mt-2">{verificationInfo}</p> : null}
              </div>
            )}
            {integrationError ? (
              <div className="card-surface p-4">
                <p className="text-xs text-destructive">{integrationError}</p>
              </div>
            ) : null}
            {integrationList.map((item) => (
              <div key={item.name} className="card-surface p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <span className="font-medium text-foreground text-sm">{item.name}</span>
                    {item.status?.lastSyncedAt ? (
                      <span className="text-xs text-muted-foreground block">{formatLastSync(item.status.lastSyncedAt)}</span>
                    ) : null}
                    {item.status?.lastError ? (
                      <span className="text-xs text-destructive block">{item.status.lastError}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      item.status?.connected ? "bg-green-500" : "bg-muted-foreground/30"
                    )}
                  />
                  {item.provider === "google" && (
                    <>
                      <button
                        onClick={() => connectIntegration("google")}
                        disabled={connectingProvider === "google" || !emailVerified}
                        className="text-xs font-medium px-3 py-1 rounded-full bg-accent text-accent-foreground hover:brightness-110 disabled:opacity-60"
                      >
                        {item.status?.requiresReconnect || !item.status?.connected ? "Connect" : "Reconnect"}
                      </button>
                      {item.status?.connected ? (
                        <button
                          onClick={() => void handleDisconnect("google")}
                          disabled={disconnectingProvider === "google"}
                          className="text-xs font-medium px-3 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground disabled:opacity-60"
                        >
                          Disconnect
                        </button>
                      ) : null}
                    </>
                  )}
                  {item.provider === "slack" && (
                    <>
                      <button
                        onClick={() => connectIntegration("slack")}
                        disabled={connectingProvider === "slack" || !emailVerified}
                        className="text-xs font-medium px-3 py-1 rounded-full bg-accent text-accent-foreground hover:brightness-110 disabled:opacity-60"
                      >
                        {item.status?.requiresReconnect || !item.status?.connected ? "Connect" : "Reconnect"}
                      </button>
                      {item.status?.connected ? (
                        <button
                          onClick={() => void handleDisconnect("slack")}
                          disabled={disconnectingProvider === "slack"}
                          className="text-xs font-medium px-3 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground disabled:opacity-60"
                        >
                          Disconnect
                        </button>
                      ) : null}
                    </>
                  )}
                  {item.provider === "crm" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/10 text-muted-foreground border border-border">
                      Coming Soon
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 3 && (
          <>
            <div className="card-surface p-6 space-y-4">
              <p className="text-sm font-medium text-foreground">Industry Keywords</p>
              <p className="text-xs text-muted-foreground">Keywords to monitor in news relevant to your business.</p>
              <input
                placeholder="e.g. SaaS, fintech, AI, marketing"
                value={newsKeywords}
                onChange={(e) => setNewsKeywords(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="card-surface p-6 space-y-4">
              <p className="text-sm font-medium text-foreground">Urgency Keywords</p>
              <p className="text-xs text-muted-foreground">
                Trigger an instant alert call when these appear in emails or Slack.
              </p>
              <input
                placeholder='e.g. "urgent", "ASAP", "we need to talk"'
                value={urgencyKeywords}
                onChange={(e) => setUrgencyKeywords(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="card-surface p-6 space-y-4">
              <p className="text-sm font-medium text-foreground">Deal Value Threshold</p>
              <p className="text-xs text-muted-foreground">
                Alert me if a deal above this value hasn&apos;t had activity.
              </p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Amount (€)</label>
                  <input
                    type="number"
                    value={dealValueThreshold}
                    onChange={(e) => setDealValueThreshold(Number(e.target.value) || 0)}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={saveUrgencyRules}
              disabled={updateMutation.isPending}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving…" : "Save urgency rules"}
            </button>
          </>
        )}

        {activeTab === 4 && (
          <div className="space-y-4">
            <div className="card-surface p-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">System Health</h3>
              {systemHealthLoading ? (
                <p className="text-sm text-muted-foreground">Loading system health…</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">Queue</p>
                      <p className="text-sm font-medium text-foreground">
                        W:{systemHealth?.queue.waiting ?? 0} A:{systemHealth?.queue.active ?? 0} D:{systemHealth?.queue.delayed ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">Recent jobs</p>
                      <p className="text-sm font-medium text-foreground">
                        {systemHealth?.queue.completedRecent ?? 0} completed / {systemHealth?.queue.failedRecent ?? 0} failed
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">Delivery rate (7d)</p>
                      <p className="text-sm font-medium text-foreground">
                        {Math.round((systemHealth?.metrics.deliveryRate7d ?? 0) * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    {systemHealth?.warnings.length ? (
                      <div className="space-y-1">
                        {systemHealth.warnings.map((warning) => (
                          <p key={warning} className="text-xs text-destructive">
                            {warning}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-green-500">No active reliability warnings.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="card-surface p-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Recent Job Events</h3>
              {jobEventsLoading ? (
                <p className="text-sm text-muted-foreground">Loading job events…</p>
              ) : jobEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent job events.</p>
              ) : (
                <div className="space-y-2">
                  {jobEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border border-border/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-xs font-medium capitalize",
                            event.eventType === "failed" ? "text-destructive" : "text-foreground"
                          )}
                        >
                          {event.mode} · {event.eventType}
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                      </div>
                      {event.detail ? <p className="text-xs text-muted-foreground mt-1">{event.detail}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SettingsPage;
