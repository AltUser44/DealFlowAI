import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not configured");
  return s;
}

export type JwtPayload = { userId: string; email: string };

/** Sign a token valid for 30 days. */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "30d" });
}

/** Express middleware — attaches req.user or returns 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret()) as JwtPayload;
    // Attach to request for downstream handlers
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
