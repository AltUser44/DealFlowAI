/**
 * Alpha Vantage COMPANY_OVERVIEW — fundamentals for scoring.
 * Free tier: ~5 req/min; batch sync slowly in production.
 */

type OverviewResponse = Record<string, string>;

function parseNum(v: string | undefined): number | undefined {
  if (v == null || v === "None" || v === "-") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export type ParsedFundamentals = {
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
  description?: string;
  country?: string;
  exchange?: string;
  marketCap?: number;
  peRatio?: number;
  evToEbitda?: number;
  revenue?: number;
  ebitda?: number;
  growthRate: number;
  profitMargin: number;
  debtToEquity?: number;
  debtScore: number;
  /** Fields that were null / missing in the AV response */
  nullFields: string[];
  raw: OverviewResponse;
};

export async function fetchCompanyOverview(
  symbol: string,
  apiKey: string
): Promise<ParsedFundamentals> {
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "OVERVIEW");
  url.searchParams.set("symbol", symbol.trim().toUpperCase());
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const data = (await res.json()) as OverviewResponse;

  if (data.Note || data.Information) {
    throw new Error(
      data.Note || data.Information || "Alpha Vantage rate limit or API message"
    );
  }

  const sym = data.Symbol?.toUpperCase() ?? symbol.toUpperCase();
  const name = data.Name || sym;
  const sector = data.Sector || undefined;
  const industry = data.Industry || undefined;
  const description = data.Description || undefined;
  const country = data.Country || undefined;
  const exchange = data.Exchange || undefined;

  const nullFields: string[] = [];

  const revenue = parseNum(data.RevenueTTM);
  if (revenue == null) nullFields.push("revenue");

  const ebitda = parseNum(data.EBITDA);
  if (ebitda == null) nullFields.push("ebitda");

  const marketCap = parseNum(data.MarketCapitalization);
  if (marketCap == null) nullFields.push("marketCap");

  const peRatio = parseNum(data.PERatio);
  if (peRatio == null) nullFields.push("peRatio");

  const evToEbitda = parseNum(data.EVToEBITDA);
  if (evToEbitda == null) nullFields.push("evToEbitda");

  const profitMargin = parseNum(data.ProfitMargin) ?? 0;
  if (parseNum(data.ProfitMargin) == null) nullFields.push("profitMargin");

  let growthRate = parseNum(data.QuarterlyRevenueGrowthYOY);
  if (growthRate == null) {
    growthRate = parseNum(data.RevenueGrowth) ?? 0;
    if (parseNum(data.RevenueGrowth) == null) nullFields.push("growthRate");
  }

  const debtToEquity = parseNum(data.DebtToEquity);
  if (debtToEquity == null) nullFields.push("debtToEquity");

  const debtScore =
    debtToEquity != null
      ? Math.min(Math.max(debtToEquity, 0), 5) / 5
      : 0.35;

  return {
    symbol: sym,
    name,
    sector,
    industry,
    description,
    country,
    exchange,
    marketCap,
    peRatio,
    evToEbitda,
    revenue,
    ebitda,
    growthRate,
    profitMargin,
    debtToEquity,
    debtScore,
    nullFields,
    raw: data,
  };
}
