import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CompanyRow, DataQuality, DualThesis, ScenarioResult } from "./api";
import { explainSymbol, fetchCompany, scoreScenario } from "./api";
import { DataQualityBar, DualThesisPanel } from "./ThesisText";
import { useWatchlist } from "./WatchlistContext";

function fmtBillions(n: number | undefined) {
  if (n == null) return "—";
  return `$${(n / 1e9).toFixed(2)}B`;
}

function pct(n: number | undefined) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number | undefined, decimals = 2) {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

/** Export the current fact pattern + thesis as a Markdown memo. */
function exportMarkdown(company: CompanyRow, thesis: DualThesis, dataQuality: DataQuality) {
  const lines: string[] = [
    `# Acquisition Memo: ${company.name} (${company.symbol})`,
    ``,
    `> Source: ${dataQuality.source}${dataQuality.lastSyncedAt ? `, as of ${new Date(dataQuality.lastSyncedAt).toLocaleString()}` : ""}`,
    ``,
    `## Fact Pattern`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Sector | ${company.sector ?? "—"} |`,
    `| Industry | ${company.industry ?? "—"} |`,
    `| Revenue (TTM) | ${fmtBillions(company.revenue)} |`,
    `| EBITDA | ${fmtBillions(company.ebitda)} |`,
    `| Market Cap | ${fmtBillions(company.marketCap)} |`,
    `| Revenue Growth (YoY) | ${pct(company.growthRate)} |`,
    `| Net Profit Margin | ${pct(company.profitMargin)} |`,
    `| Debt / Equity | ${company.debtToEquity != null ? company.debtToEquity.toFixed(2) : "— (default 0.35 burden used)"} |`,
    `| P/E Ratio | ${fmtNum(company.peRatio, 1)}x |`,
    `| EV/EBITDA | ${fmtNum(company.evToEbitda, 1)}x |`,
    `| Acquisition Score | ${company.score?.toFixed(3) ?? "—"} |`,
    ``,
  ];

  if (dataQuality.nullFields.length > 0) {
    lines.push(`> **Missing fields:** ${dataQuality.nullFields.join(", ")}`);
    lines.push(``);
  }

  lines.push(`## Strategic Thesis`, ``);
  thesis.strategic.split(/\n\n+/).forEach((p) => {
    lines.push(p.trim(), ``);
  });

  lines.push(`## Financial Thesis`, ``);
  thesis.financial.split(/\n\n+/).forEach((p) => {
    lines.push(p.trim(), ``);
  });

  lines.push(`---`, `*Internal use only. Not investment advice.*`);

  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${company.symbol}_memo.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export/print as PDF via browser print dialog. */
function exportPdf(company: CompanyRow, thesis: DualThesis, dataQuality: DataQuality) {
  const syncStr = dataQuality.lastSyncedAt
    ? new Date(dataQuality.lastSyncedAt).toLocaleString()
    : "unknown";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${company.symbol} Acquisition Memo</title>
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 40px auto; color: #111; line-height: 1.7; }
  h1 { font-size: 22px; border-bottom: 2px solid #b8860b; padding-bottom: 8px; }
  h2 { font-size: 16px; color: #b8860b; margin-top: 28px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 5px 10px; text-align: left; }
  th { background: #f5f5f0; }
  .source { font-size: 12px; color: #666; margin-bottom: 20px; }
  .missing { background: #fff8e1; padding: 6px 10px; border-left: 3px solid #f0ad00; font-size: 12px; margin: 10px 0; }
  p { margin: 0 0 12px; }
  footer { font-size: 11px; color: #999; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; }
</style>
</head>
<body>
<h1>Acquisition Memo: ${company.name} (${company.symbol})</h1>
<p class="source">${dataQuality.source}, as of ${syncStr}</p>
${dataQuality.nullFields.length ? `<div class="missing">Missing fields: ${dataQuality.nullFields.join(", ")}</div>` : ""}
<h2>Fact Pattern</h2>
<table>
<tr><th>Metric</th><th>Value</th></tr>
<tr><td>Sector</td><td>${company.sector ?? "—"}</td></tr>
<tr><td>Industry</td><td>${company.industry ?? "—"}</td></tr>
<tr><td>Revenue (TTM)</td><td>${fmtBillions(company.revenue)}</td></tr>
<tr><td>EBITDA</td><td>${fmtBillions(company.ebitda)}</td></tr>
<tr><td>Market Cap</td><td>${fmtBillions(company.marketCap)}</td></tr>
<tr><td>Revenue Growth (YoY)</td><td>${pct(company.growthRate)}</td></tr>
<tr><td>Net Profit Margin</td><td>${pct(company.profitMargin)}</td></tr>
<tr><td>Debt / Equity</td><td>${company.debtToEquity != null ? company.debtToEquity.toFixed(2) : "— (default 0.35 burden)"}</td></tr>
<tr><td>P/E Ratio</td><td>${fmtNum(company.peRatio, 1)}x</td></tr>
<tr><td>EV/EBITDA</td><td>${fmtNum(company.evToEbitda, 1)}x</td></tr>
<tr><td>Acquisition Score</td><td>${company.score?.toFixed(3) ?? "—"}</td></tr>
</table>
<h2>Strategic Thesis</h2>
${thesis.strategic.split(/\n\n+/).map((p) => `<p>${p.trim()}</p>`).join("\n")}
<h2>Financial Thesis</h2>
${thesis.financial.split(/\n\n+/).map((p) => `<p>${p.trim()}</p>`).join("\n")}
<footer>Internal use only. Not investment advice. Score formula: growth×0.4 + margin×0.3 − debt×0.3</footer>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export default function CompanyDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const { add, remove, has } = useWatchlist();

  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [thesis, setThesis] = useState<DualThesis | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [thesisLoading, setThesisLoading] = useState(false);
  const [thesisErr, setThesisErr] = useState<string | null>(null);

  // Scenario state
  const [scenarioGrowth, setScenarioGrowth] = useState("");
  const [scenarioMargin, setScenarioMargin] = useState("");
  const [scenarioDE, setScenarioDE] = useState("");
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [scenarioErr, setScenarioErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setErr(null);
    try {
      const c = await fetchCompany(symbol);
      setCompany(c);
      setScenarioGrowth(((c.growthRate ?? 0) * 100).toFixed(1));
      setScenarioMargin(((c.profitMargin ?? 0) * 100).toFixed(1));
      setScenarioDE(c.debtToEquity != null ? c.debtToEquity.toFixed(2) : "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load company");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    load();
  }, [load]);

  async function onGenerateThesis() {
    if (!symbol) return;
    setThesisLoading(true);
    setThesisErr(null);
    try {
      const r = await explainSymbol(symbol);
      setThesis(r.thesis);
      setDataQuality(r.dataQuality);
    } catch (e) {
      setThesisErr(e instanceof Error ? e.message : "Could not generate thesis");
    } finally {
      setThesisLoading(false);
    }
  }

  async function onRunScenario() {
    if (!symbol || !company) return;
    const growth = parseFloat(scenarioGrowth) / 100;
    const margin = parseFloat(scenarioMargin) / 100;
    const de = scenarioDE !== "" ? parseFloat(scenarioDE) : undefined;
    if (!Number.isFinite(growth) || !Number.isFinite(margin)) {
      setScenarioErr("Enter valid numbers for growth and margin.");
      return;
    }
    setScenarioBusy(true);
    setScenarioErr(null);
    try {
      const r = await scoreScenario(symbol, growth, margin, de);
      setScenarioResult(r);
    } catch (e) {
      setScenarioErr(e instanceof Error ? e.message : "Scenario failed");
    } finally {
      setScenarioBusy(false);
    }
  }

  const inWatchlist = symbol ? has(symbol) : false;

  function toggleWatchlist() {
    if (!company || !symbol) return;
    if (inWatchlist) remove(symbol);
    else add(company);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (err || !company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">{err ?? "Company not found."}</p>
        <Link to="/" className="text-gold-400 hover:underline text-sm">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-slate-100">
      {/* Header */}
      <header className="border-b border-white/10 bg-ink-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              to="/"
              className="font-mono text-xs uppercase tracking-[0.2em] text-gold-500 hover:underline"
            >
              ← DealFlow AI
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              {company.symbol}
            </h1>
            <p className="mt-1 text-slate-400">{company.name}</p>
            {company.sector && (
              <p className="mt-0.5 text-xs text-slate-500">
                {company.sector}
                {company.industry ? ` · ${company.industry}` : ""}
                {company.country ? ` · ${company.country}` : ""}
                {company.exchange ? ` (${company.exchange})` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={toggleWatchlist}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                inWatchlist
                  ? "border-gold-500/60 bg-gold-500/15 text-gold-300 hover:bg-gold-500/25"
                  : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {inWatchlist ? "★ In watchlist" : "☆ Add to watchlist"}
            </button>
            {thesis && dataQuality && (
              <>
                <button
                  type="button"
                  onClick={() => exportMarkdown(company, thesis, dataQuality)}
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 transition"
                >
                  Export .md
                </button>
                <button
                  type="button"
                  onClick={() => exportPdf(company, thesis, dataQuality)}
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 transition"
                >
                  Print / PDF
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* Score + key metrics */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Score", value: company.score?.toFixed(3) ?? "—", highlight: true },
            { label: "Growth (YoY)", value: pct(company.growthRate) },
            { label: "Net margin", value: pct(company.profitMargin) },
            { label: "D/E", value: company.debtToEquity != null ? company.debtToEquity.toFixed(2) : "—" },
            { label: "Revenue", value: fmtBillions(company.revenue) },
            { label: "EBITDA", value: fmtBillions(company.ebitda) },
            { label: "Market cap", value: fmtBillions(company.marketCap) },
            { label: "P/E", value: company.peRatio != null ? `${company.peRatio.toFixed(1)}x` : "—" },
          ].map(({ label, value, highlight }) => (
            <div
              key={label}
              className={`rounded-xl border p-4 ${
                highlight
                  ? "border-gold-500/30 bg-gold-500/5"
                  : "border-white/10 bg-ink-900/40"
              }`}
            >
              <p className="text-xs text-slate-500">{label}</p>
              <p
                className={`mt-1 font-mono text-xl font-semibold ${
                  highlight ? "text-gold-400" : "text-white"
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </section>

        {/* Data quality strip */}
        {company.lastSyncedAt && (
          <DataQualityBar
            dq={{
              lastSyncedAt: company.lastSyncedAt,
              nullFields: company.nullFields ?? [],
              source: "Alpha Vantage OVERVIEW",
            }}
            symbol={company.symbol}
          />
        )}

        {/* Description */}
        {company.description && (
          <section className="rounded-2xl border border-white/10 bg-ink-900/40 p-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Business Description
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">{company.description}</p>
          </section>
        )}

        {/* Scenario modeler */}
        <section className="rounded-2xl border border-white/10 bg-ink-900/40 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">
            Scenario Score
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Adjust assumptions and rerun the model without persisting.
            Formula: growth×0.4 + margin×0.3 − debt×0.3
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: "Revenue growth (%)",
                value: scenarioGrowth,
                onChange: setScenarioGrowth,
                placeholder: "e.g. 12.5",
              },
              {
                label: "Net margin (%)",
                value: scenarioMargin,
                onChange: setScenarioMargin,
                placeholder: "e.g. 20.0",
              },
              {
                label: "Debt / Equity",
                value: scenarioDE,
                onChange: setScenarioDE,
                placeholder: "leave blank = default 0.35",
              },
            ].map(({ label, value, onChange, placeholder }) => (
              <div key={label}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <input
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 font-mono text-sm text-white outline-none ring-gold-500/30 focus:ring-2"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <button
              type="button"
              disabled={scenarioBusy}
              onClick={onRunScenario}
              className="rounded-lg bg-gradient-to-r from-gold-600 to-gold-500 px-5 py-2 text-sm font-semibold text-ink-950 shadow-lg shadow-gold-900/20 transition hover:brightness-110 disabled:opacity-50"
            >
              {scenarioBusy ? "Running…" : "Run scenario"}
            </button>
            {scenarioResult && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">Scenario score:</span>
                <span className="font-mono text-xl font-semibold text-gold-400">
                  {scenarioResult.score.toFixed(3)}
                </span>
                {company.score != null && (
                  <span
                    className={`text-xs font-mono ${
                      scenarioResult.score > company.score
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {scenarioResult.score > company.score ? "+" : ""}
                    {(scenarioResult.score - company.score).toFixed(3)} vs base
                  </span>
                )}
              </div>
            )}
            {scenarioErr && (
              <p className="text-xs text-red-400">{scenarioErr}</p>
            )}
          </div>
        </section>

        {/* Thesis */}
        <section className="rounded-2xl border border-white/10 bg-ink-900/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              Acquisition Thesis
            </h2>
            {!thesis && !thesisLoading && (
              <button
                type="button"
                onClick={onGenerateThesis}
                className="rounded-lg bg-gradient-to-r from-gold-600 to-gold-500 px-4 py-1.5 text-sm font-semibold text-ink-950 transition hover:brightness-110"
              >
                Generate thesis
              </button>
            )}
          </div>

          {thesisErr && (
            <p className="text-sm text-red-400 mb-3">{thesisErr}</p>
          )}

          <DualThesisPanel
            thesis={thesis}
            dataQuality={dataQuality}
            symbol={company.symbol}
            loading={thesisLoading}
          />

          {!thesis && !thesisLoading && !thesisErr && (
            <p className="text-slate-600 text-sm">
              Click "Generate thesis" to produce strategic and financial memos from synced fundamentals.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
