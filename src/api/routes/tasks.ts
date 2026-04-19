import { Router } from "express";
import { z } from "zod";
import { createTask, deleteTask, getTasks, updateTask } from "../../tasks/taskStore";
import { AuthenticatedRequest, requireAuth, requireVerifiedAuth } from "../middleware/auth";

export const tasksRouter = Router();
const createTaskSchema = z.object({
  text: z.string().min(1),
  source: z.enum(["email", "slack", "manual"]).optional(),
  priority: z.enum(["CRITICAL", "HIGH", "NORMAL", "FYI"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(["open", "done", "snoozed", "delegated"]).optional()
});
const patchTaskSchema = z.object({
  text: z.string().min(1).optional(),
  priority: z.enum(["CRITICAL", "HIGH", "NORMAL", "FYI"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(["open", "done", "snoozed", "delegated"]).optional()
});

tasksRouter.use(requireAuth);
tasksRouter.use(requireVerifiedAuth);

tasksRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const tasks = await getTasks(req.user!.id);
  res.json(tasks);
});

tasksRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid task payload" });
    return;
  }

  const task = await createTask({
    userId: req.user!.id,
    text: parsed.data.text,
    source: parsed.data.source ?? "manual",
    priority: parsed.data.priority ?? "NORMAL",
    dueDate: parsed.data.dueDate ?? null,
    status: parsed.data.status ?? "open"
  });
  res.status(201).json(task);
});

tasksRouter.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const parsed = patchTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid task update payload" });
    return;
  }
  const updated = await updateTask(String(req.params.id), req.user!.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(updated);
});

tasksRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const deleted = await deleteTask(String(req.params.id), req.user!.id);
  res.json({ deleted });
});
