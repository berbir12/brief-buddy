import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";

export interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

const UUID_PARAM_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const token = authHeader.slice("Bearer ".length);
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload || typeof payload !== "object" || typeof (payload as { sub?: unknown }).sub !== "string") {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }
    const sub = (payload as { sub: string }).sub;
    if (!UUID_PARAM_RE.test(sub)) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    req.user = { id: sub };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
