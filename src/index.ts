import path from "node:path";
import type { Server } from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { initializeDatabase } from "./db/init";
import { pool, seedDemoUser } from "./db/queries";
import { authRouter } from "./api/routes/auth";
import { briefingsRouter } from "./api/routes/briefings";
import { tasksRouter } from "./api/routes/tasks";
import { settingsRouter } from "./api/routes/settings";
import { voiceRouter } from "./api/routes/voice";
import { registerMorningBriefingJob } from "./scheduler/morningBriefing";
import { registerEveningWrapupJob } from "./scheduler/eveningWrapup";
import { registerWeeklyRecapJob } from "./scheduler/weeklyRecap";
import { registerUrgencyWatcherJob } from "./scheduler/urgencyWatcher";
import { createBriefingWorker } from "./scheduler/worker";
import { briefingQueue } from "./scheduler/queue";
import { runReliabilityHealthChecks } from "./scheduler/healthMonitor";

async function bootstrap(): Promise<void> {
  await initializeDatabase();
  await seedDemoUser();

  await Promise.all([
    registerMorningBriefingJob(),
    registerEveningWrapupJob(),
    registerWeeklyRecapJob(),
    registerUrgencyWatcherJob()
  ]);

  const worker = createBriefingWorker();
  let healthMonitorHandle: NodeJS.Timeout | null = null;
  worker.on("failed", (job, err) => {
    const attempts = job?.attemptsMade ?? 0;
    console.error(`Worker failed for job ${job?.id} (attempt ${attempts}):`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`Worker completed job ${job.id}`);
  });

  // Background reliability checks create actionable alerts for operators.
  const runHealthChecksSafely = async () => {
    try {
      await runReliabilityHealthChecks();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[health-monitor] check failed:", message);
    }
  };
  await runHealthChecksSafely();
  healthMonitorHandle = setInterval(() => {
    void runHealthChecksSafely();
  }, 5 * 60 * 1000);
  healthMonitorHandle.unref();

  const app = express();
  let shuttingDown = false;
  app.use(cors());
  app.use(helmet());
  app.use(morgan("dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/ready", async (_req, res) => {
    if (shuttingDown) {
      res.status(503).json({
        status: "not_ready",
        timestamp: new Date().toISOString(),
        error: "Server is shutting down"
      });
      return;
    }
    try {
      await pool.query("SELECT 1");
      await briefingQueue.waitUntilReady();
      res.json({
        status: "ready",
        timestamp: new Date().toISOString(),
        dependencies: {
          database: "ok",
          queue: "ok"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Readiness check failed";
      res.status(503).json({
        status: "not_ready",
        timestamp: new Date().toISOString(),
        error: message
      });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/briefings", briefingsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/voice", voiceRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Unhandled API error:", err);
    if (env.NODE_ENV !== "production") {
      res.status(500).json({ error: "Internal server error", detail: message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  });

  if (env.NODE_ENV === "production") {
    const frontendDir = path.join(process.cwd(), "frontend", "dist");
    app.use(express.static(frontendDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(frontendDir, "index.html"));
    });
  }

  const server: Server = app.listen(env.PORT, () => {
    console.log(`Brief Buddy API listening on port ${env.PORT}`);
  });

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down...`);

    await Promise.allSettled([
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
      worker.close(),
      briefingQueue.close(),
      pool.end()
    ]);
    if (healthMonitorHandle) {
      clearInterval(healthMonitorHandle);
    }
    console.log("Shutdown complete.");
    process.exit(0);
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrap().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
