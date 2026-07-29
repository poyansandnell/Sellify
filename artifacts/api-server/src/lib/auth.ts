import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

export function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) || auth?.userId || null;
}

export interface AuthedRequest extends Request {
  userId: string;
}

/**
 * Diagnostic helper: describe WHY an authenticated request failed without
 * logging any secret material. Decodes (does NOT verify) the bearer token
 * payload to expose issuer/azp/expiry so token-vs-instance mismatches are
 * visible in production logs.
 */
function describeAuthFailure(req: Request): Record<string, unknown> {
  const header = req.headers.authorization;
  if (!header) return { authHeader: false };
  const info: Record<string, unknown> = { authHeader: true };
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { ...info, reason: "not a Bearer token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ...info, reason: "not a JWT" };
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    info.iss = payload.iss;
    info.azp = payload.azp;
    info.expired = typeof payload.exp === "number" ? payload.exp * 1000 < Date.now() : null;
  } catch {
    info.reason = "unparseable JWT payload";
  }
  return info;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    logger.warn(
      { path: req.originalUrl?.split("?")[0], ...describeAuthFailure(req) },
      "auth rejected (401)",
    );
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}
