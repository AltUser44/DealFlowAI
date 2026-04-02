import { Router } from "express";
import { z } from "zod";
import type { Request } from "express";
import type { JwtPayload } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Company } from "../models/Company.js";
import { computeAcquisitionScore } from "../services/scoring.js";

const router = Router();

type AuthRequest = Request & { user: JwtPayload };

function user(req: Request): JwtPayload {
  return (req as AuthRequest).user;
}

/** GET /api/watchlist — return symbols + full company docs */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const u = await User.findById(user(req).userId).lean();
    if (!u) { res.status(404).json({ error: "User not found" }); return; }

    const companies = u.watchlist.length
      ? await Company.find({ symbol: { $in: u.watchlist } }).lean()
      : [];

    // Preserve watchlist order
    const ordered = u.watchlist
      .map((sym) => companies.find((c) => c.symbol === sym))
      .filter(Boolean);

    res.json({ watchlist: u.watchlist, companies: ordered });
  } catch (e) { next(e); }
});

const symbolBody = z.object({ symbol: z.string().min(1) });

/** POST /api/watchlist — add symbol */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { symbol } = symbolBody.parse(req.body);
    const sym = symbol.toUpperCase();

    await User.findByIdAndUpdate(
      user(req).userId,
      { $addToSet: { watchlist: sym } }
    );
    res.json({ ok: true, symbol: sym });
  } catch (e) { next(e); }
});

/** DELETE /api/watchlist/:symbol — remove symbol */
router.delete("/:symbol", requireAuth, async (req, res, next) => {
  try {
    const sym = String(req.params.symbol).toUpperCase();
    await User.findByIdAndUpdate(
      user(req).userId,
      { $pull: { watchlist: sym } }
    );
    res.json({ ok: true, symbol: sym });
  } catch (e) { next(e); }
});

const scenarioBody = z.object({
  /** Absolute delta applied to each company's stored value (e.g. -0.05 = −5 pp) */
  growthDelta: z.number().default(0),
  marginDelta: z.number().default(0),
  /** Absolute delta on D/E ratio */
  deDelta: z.number().default(0),
});

/**
 * POST /api/watchlist/scenario
 * Recompute scores for every watchlist company under a shared assumption shock.
 * Does NOT persist anything.
 */
router.post("/scenario", requireAuth, async (req, res, next) => {
  try {
    const { growthDelta, marginDelta, deDelta } = scenarioBody.parse(req.body);

    const u = await User.findById(user(req).userId).lean();
    if (!u) { res.status(404).json({ error: "User not found" }); return; }

    const companies = u.watchlist.length
      ? await Company.find({ symbol: { $in: u.watchlist } }).lean()
      : [];

    const results = companies.map((c) => {
      const adjGrowth  = (c.growthRate  ?? 0)    + growthDelta;
      const adjMargin  = (c.profitMargin ?? 0)   + marginDelta;
      const baseDE     = c.debtToEquity ?? null;
      const adjDE      = baseDE != null ? baseDE + deDelta : null;
      const adjDebtScore = adjDE != null
        ? Math.min(Math.max(adjDE, 0), 5) / 5
        : (c.debtScore ?? 0.35);

      const baseScore = c.score ?? 0;
      const scenarioScore = computeAcquisitionScore({
        growthRate:    adjGrowth,
        profitMargin:  adjMargin,
        debtScore:     adjDebtScore,
      });

      return {
        symbol:        c.symbol,
        name:          c.name,
        baseScore,
        scenarioScore,
        delta:         Math.round((scenarioScore - baseScore) * 1000) / 1000,
        inputs: {
          growthRate:   adjGrowth,
          profitMargin: adjMargin,
          debtToEquity: adjDE,
        },
      };
    });

    // Sort by scenario score descending
    results.sort((a, b) => b.scenarioScore - a.scenarioScore);

    res.json({ results, assumptions: { growthDelta, marginDelta, deDelta } });
  } catch (e) { next(e); }
});

export default router;
