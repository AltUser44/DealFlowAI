import Anthropic from "@anthropic-ai/sdk";

/** See https://docs.anthropic.com/en/docs/about-claude/models — older snapshot IDs are retired. */
const MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export type CompanyBrief = {
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
  revenue?: number;
  growthRate?: number;
  profitMargin?: number;
  debtToEquity?: number;
  ebitda?: number;
  marketCap?: number;
  peRatio?: number;
  score?: number;
  nullFields?: string[];
  lastSyncedAt?: Date | string;
};

export type DualThesis = {
  strategic: string;
  financial: string;
};

/** Remove markdown artifacts so the UI can render clean prose. */
export function stripMarkdownNoise(text: string): string {
  let s = text.trim().replace(/\r\n/g, "\n");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/^[-*]\s+/gm, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function buildFactsBlock(company: CompanyBrief): string {
  return [
    `Company: ${company.name} (${company.symbol})`,
    company.sector ? `Sector: ${company.sector}` : null,
    company.industry ? `Industry: ${company.industry}` : null,
    company.revenue != null
      ? `Revenue (TTM): $${(company.revenue / 1e9).toFixed(2)}B`
      : null,
    company.ebitda != null
      ? `EBITDA (TTM): $${(company.ebitda / 1e9).toFixed(2)}B`
      : null,
    company.marketCap != null
      ? `Market cap: $${(company.marketCap / 1e9).toFixed(2)}B`
      : null,
    `Revenue growth (YoY): ${((company.growthRate ?? 0) * 100).toFixed(1)}%`,
    `Net profit margin: ${((company.profitMargin ?? 0) * 100).toFixed(1)}%`,
    company.debtToEquity != null
      ? `Debt/equity: ${company.debtToEquity.toFixed(2)}`
      : "Debt/equity: not provided (score uses default 0.35 burden)",
    company.peRatio != null ? `P/E ratio: ${company.peRatio.toFixed(1)}x` : null,
    `Model acquisition score (internal heuristic): ${company.score?.toFixed(3) ?? "n/a"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Generate strategic AND financial thesis in a single Claude call. */
export async function explainAcquisitionThesisDual(
  apiKey: string,
  company: CompanyBrief
): Promise<DualThesis> {
  const client = new Anthropic({ apiKey });
  const facts = buildFactsBlock(company);

  const instructions = `You are a senior investment banking M&A associate. Produce TWO short memos from the same fact set, separated by the delimiter "===FINANCIAL===".

FACTS (use only these for any numbers; do not fabricate market data, EV, share prices, forward estimates, or multiples not stated below):
${facts}

OUTPUT FORMAT — produce exactly this structure (no headings, no markdown, no asterisks):
<strategic memo — 2-3 paragraphs>
===FINANCIAL===
<financial memo — 2-3 paragraphs>

STRATEGIC MEMO rules:
- Angle: market structure, strategic rationale, synergies (revenue or cost), competitive moat of the target, antitrust/regulatory considerations (qualitative only — do not predict outcomes).
- Do NOT reference the internal acquisition score or specific margin/leverage numbers; speak about positioning and strategic fit.
- Tone: deal team briefing note, concise and frank.

FINANCIAL MEMO rules:
- Angle: margin profile, leverage capacity, revenue growth compounding, what the model score implies about relative attractiveness.
- Reference the specific figures from the facts block (margin %, D/E, growth rate, revenue).
- If D/E is missing, acknowledge the default assumption used in scoring.
- Tone: credit/financial sponsor-style, numbers-forward.

SHARED rules:
- Plain text only: no markdown, no ** asterisks, no # headings, no bullets, no numbered lists.
- Separate paragraphs within each memo with a blank line.
- Do not include disclaimers or "not investment advice" language.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    messages: [{ role: "user", content: instructions }],
  });

  const block = msg.content[0];
  if (block.type !== "text") throw new Error("Unexpected response from Claude");

  const raw = block.text.trim();
  const splitIdx = raw.indexOf("===FINANCIAL===");
  if (splitIdx === -1) {
    // Fallback: treat whole response as strategic
    return { strategic: stripMarkdownNoise(raw), financial: "" };
  }

  const strategic = stripMarkdownNoise(raw.slice(0, splitIdx).trim());
  const financial = stripMarkdownNoise(raw.slice(splitIdx + 15).trim());
  return { strategic, financial };
}

/** Legacy single-variant thesis (kept for backward compat). */
export async function explainAcquisitionThesis(
  apiKey: string,
  company: CompanyBrief
): Promise<string> {
  const { strategic } = await explainAcquisitionThesisDual(apiKey, company);
  return strategic;
}
