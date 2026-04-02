import { Router } from "express";
import { z } from "zod";
import { Company } from "../models/Company.js";
import { fetchCompanyOverview } from "../services/alphaVantage.js";
import { computeAcquisitionScore } from "../services/scoring.js";
import { explainAcquisitionThesisDual } from "../services/llm.js";

const router = Router();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function upsertFromOverview(symbol: string) {
  const key = requireEnv("ALPHA_VANTAGE_API_KEY");
  const f = await fetchCompanyOverview(symbol, key);
  const score = computeAcquisitionScore({
    growthRate: f.growthRate,
    profitMargin: f.profitMargin,
    debtScore: f.debtScore,
  });

  const doc = await Company.findOneAndUpdate(
    { symbol: f.symbol },
    {
      name: f.name,
      sector: f.sector,
      industry: f.industry,
      description: f.description,
      country: f.country,
      exchange: f.exchange,
      marketCap: f.marketCap,
      peRatio: f.peRatio,
      evToEbitda: f.evToEbitda,
      revenue: f.revenue,
      ebitda: f.ebitda,
      growthRate: f.growthRate,
      profitMargin: f.profitMargin,
      debtScore: f.debtScore,
      debtToEquity: f.debtToEquity,
      score,
      lastSyncedAt: new Date(),
      nullFields: f.nullFields,
      rawOverview: f.raw,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc;
}

/** GET /api/companies — stored companies with scores */
router.get("/companies", async (_req, res, next) => {
  try {
    const rows = await Company.find()
      .sort({ score: -1, symbol: 1 })
      .lean();
    res.json({ companies: rows });
  } catch (e) {
    next(e);
  }
});

/** GET /api/companies/:symbol — single company detail */
router.get("/companies/:symbol", async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const company = await Company.findOne({ symbol }).lean();
    if (!company) {
      res.status(404).json({ error: "Company not found. Sync this symbol first." });
      return;
    }
    res.json({ company });
  } catch (e) {
    next(e);
  }
});

const syncBody = z.object({
  symbols: z.array(z.string().min(1)).min(1),
});

/** POST /api/companies/sync — pull Alpha Vantage & persist */
router.post("/companies/sync", async (req, res, next) => {
  try {
    const { symbols } = syncBody.parse(req.body);
    const results: { symbol: string; ok: boolean; error?: string }[] = [];
    for (const s of symbols) {
      try {
        await upsertFromOverview(s);
        results.push({ symbol: s.toUpperCase(), ok: true });
      } catch (e) {
        results.push({
          symbol: s.toUpperCase(),
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    res.json({ results });
  } catch (e) {
    next(e);
  }
});

const analyzeBody = z.object({
  /** If set, refetch Alpha Vantage and persist + score this symbol */
  symbol: z.string().optional(),
});

/** POST /api/analyze — run scoring on all stored rows, or refresh one symbol from AV */
router.post("/analyze", async (req, res, next) => {
  try {
    const { symbol } = analyzeBody.parse(req.body ?? {});

    if (symbol) {
      const doc = await upsertFromOverview(symbol);
      return res.json({ company: doc });
    }

    const all = await Company.find();
    const companies = [];
    for (const c of all) {
      const score = computeAcquisitionScore({
        growthRate: c.growthRate ?? 0,
        profitMargin: c.profitMargin ?? 0,
        debtScore: c.debtScore ?? 0.35,
      });
      c.score = score;
      await c.save();
      companies.push(c.toObject());
    }
    res.json({ rescored: companies.length, companies });
  } catch (e) {
    next(e);
  }
});

const scoreBody = z.object({
  symbol: z.string().min(1),
  growthRate: z.number(),
  profitMargin: z.number(),
  debtToEquity: z.number().optional(),
});

/** POST /api/score — compute a scenario score without persisting */
router.post("/score", async (req, res, next) => {
  try {
    const { symbol, growthRate, profitMargin, debtToEquity } = scoreBody.parse(req.body);
    const debtScore =
      debtToEquity != null
        ? Math.min(Math.max(debtToEquity, 0), 5) / 5
        : 0.35;
    const score = computeAcquisitionScore({ growthRate, profitMargin, debtScore });
    res.json({ symbol: symbol.toUpperCase(), score, inputs: { growthRate, profitMargin, debtToEquity, debtScore } });
  } catch (e) {
    next(e);
  }
});

/** GET /api/deals — top acquisition targets */
router.get("/deals", async (req, res, next) => {
  try {
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      50
    );
    const top = await Company.find({ score: { $exists: true } })
      .sort({ score: -1, symbol: 1 })
      .limit(limit)
      .lean();
    res.json({ deals: top, count: top.length });
  } catch (e) {
    next(e);
  }
});

const explainBody = z.object({
  symbol: z.string().min(1),
});

/** POST /api/explain — LLM dual thesis (strategic + financial) */
router.post("/explain", async (req, res, next) => {
  try {
    const { symbol } = explainBody.parse(req.body);
    const company = await Company.findOne({
      symbol: symbol.toUpperCase(),
    });
    if (!company) {
      res.status(404).json({ error: "Company not found. Sync symbols first." });
      return;
    }
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      res.status(503).json({
        error: "ANTHROPIC_API_KEY not configured",
      });
      return;
    }
    const thesis = await explainAcquisitionThesisDual(key, {
      symbol: company.symbol,
      name: company.name,
      sector: company.sector ?? undefined,
      industry: company.industry ?? undefined,
      revenue: company.revenue ?? undefined,
      ebitda: company.ebitda ?? undefined,
      marketCap: company.marketCap ?? undefined,
      growthRate: company.growthRate ?? undefined,
      profitMargin: company.profitMargin ?? undefined,
      debtToEquity: company.debtToEquity ?? undefined,
      peRatio: company.peRatio ?? undefined,
      score: company.score ?? undefined,
      nullFields: company.nullFields ?? [],
      lastSyncedAt: company.lastSyncedAt ?? undefined,
    });
    res.json({
      symbol: company.symbol,
      // Keep legacy field for any older client code
      explanation: thesis.strategic,
      thesis,
      dataQuality: {
        lastSyncedAt: company.lastSyncedAt,
        nullFields: company.nullFields ?? [],
        source: "Alpha Vantage OVERVIEW",
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
