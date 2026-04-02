/**
 * One-shot: sync DEFAULT_SYMBOLS from .env (comma-separated).
 * Run: npm run sync
 */
import "dotenv/config";
import mongoose from "mongoose";
import { fetchCompanyOverview } from "../services/alphaVantage.js";
import { computeAcquisitionScore } from "../services/scoring.js";
import { Company } from "../models/Company.js";

const DEFAULT =
  process.env.DEFAULT_SYMBOLS ||
  "MSFT,AAPL,GOOGL,AMZN,JPM,V,MA,UNH,JNJ,XOM";

async function run() {
  const uri = process.env.MONGODB_URI;
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!uri || !key) {
    console.error("Need MONGODB_URI and ALPHA_VANTAGE_API_KEY");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const symbols = DEFAULT.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  for (const symbol of symbols) {
    try {
      const f = await fetchCompanyOverview(symbol, key);
      const score = computeAcquisitionScore({
        growthRate: f.growthRate,
        profitMargin: f.profitMargin,
        debtScore: f.debtScore,
      });
      await Company.findOneAndUpdate(
        { symbol: f.symbol },
        {
          name: f.name,
          sector: f.sector,
          revenue: f.revenue,
          growthRate: f.growthRate,
          profitMargin: f.profitMargin,
          debtScore: f.debtScore,
          debtToEquity: f.debtToEquity,
          score,
          lastSyncedAt: new Date(),
          rawOverview: f.raw,
        },
        { upsert: true, new: true }
      );
      console.log("OK", f.symbol, "score", score);
    } catch (e) {
      console.error("FAIL", symbol, e);
    }
    await new Promise((r) => setTimeout(r, 13_000));
  }

  await mongoose.disconnect();
}

run();
