import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import ModeBadge from "@/components/ModeBadge";
import AudioPlayer from "@/components/AudioPlayer";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBriefingJobEvents, getBriefingsHistory, type BriefingJobEvent, type BriefingRow } from "@/lib/api";

type Mode = "morning" | "evening" | "alert" | "weekly";

const BriefingsPage = () => {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<string>("all");

  const { data: briefings = [], isLoading } = useQuery({
    queryKey: ["briefings"],
    queryFn: getBriefingsHistory,
  });

  const { data: jobEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["briefing-job-events"],
    queryFn: () => getBriefingJobEvents(20),
    refetchInterval: 60_000,
  });

  const filtered: BriefingRow[] =
    filterMode === "all"
      ? briefings
      : briefings.filter((b) => b.mode === filterMode);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-1">Briefing History</h1>
      <p className="text-sm text-muted-foreground mb-8">Review and replay past briefings.</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["all", "morning", "evening", "alert", "weekly"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setFilterMode(m)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
              filterMode === m
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground bg-secondary hover:text-foreground"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading briefings…</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-surface overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-28 flex-shrink-0">
                    {new Date(b.createdAt).toLocaleDateString()}
                  </span>
                  <ModeBadge mode={b.mode as Mode} />
                  <span className="text-xs text-green-500/80 hidden sm:inline capitalize">
                    {b.deliveryStatus}
                  </span>
                </div>
                {expanded === i ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              {expanded === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="px-4 pb-4 border-t border-border/30"
                >
                  <p className="text-sm text-muted-foreground leading-relaxed my-4">
                    {b.script}
                  </p>
                  {b.audioUrl && (
                    <AudioPlayer compact duration="—" src={b.audioUrl} />
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No briefings yet. Trigger one from the Dashboard.</p>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Recent Job Events</h2>
        {eventsLoading ? (
          <p className="text-sm text-muted-foreground">Loading job events…</p>
        ) : jobEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent job events.</p>
        ) : (
          <div className="space-y-2">
            {jobEvents.map((event: BriefingJobEvent) => (
              <div key={event.id} className="card-surface p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ModeBadge mode={event.mode as Mode} />
                    <span
                      className={cn(
                        "font-medium capitalize",
                        event.eventType === "failed" ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {event.eventType}
                    </span>
                  </div>
                  <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                {event.detail ? <p className="text-muted-foreground mt-1">{event.detail}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BriefingsPage;
