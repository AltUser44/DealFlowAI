import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CompanyRow, DataQuality, DualThesis } from "./api";
import {
  explainSymbol,
  fetchCompanies,
  fetchDeals,
  fetchHealth,
  runAnalyze,
  syncSymbols,
} from "./api";
import { AuthModal } from "./AuthModal";
import { useAuth } from "./AuthContext";
import { BasketScenarioPanel } from "./BasketScenarioPanel";
import DealCharts from "./DealCharts";
import { DualThesisPanel } from "./ThesisText";
import { useWatchlist } from "./WatchlistContext";

function fmtBillions(n: number | undefined) {
  if (n == null) return "—";
  return `$${(n / 1e9).toFixed(2)}B`;
}

function pct(n: number | undefined) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function NullFieldsBadge({ fields }: { fields?: string[] }) {
  if (!fields || fields.length === 0) return null;
  return (
    <span
      title={`Missing from Alpha Vantage: ${fields.join(", ")}`}
      className="ml-1 rounded bg-amber-900/30 border border-amber-700/30 px-1 py-0.5 font-mono text-[10px] text-amber-400 cursor-help"
    >
      {fields.length} field{fields.length > 1 ? "s" : ""} missing
    </span>
  );
}

export default function App() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [deals, setDeals] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [syncInput, setSyncInput] = useState("MSFT,AAPL,GOOGL");
  const [busy, setBusy] = useState(false);
  const [explainOpen, setExplainOpen] = useState<string | null>(null);
  const [thesis, setThesis] = useState<DualThesis | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const { watchlist, remove, syncing: watchlistSyncing } = useWatchlist();
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const { token, email, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const health = await fetchHealth();
      if (!health.ok) {
        setErr(
          "Cannot reach the API. Start the backend in another terminal:\n\ncd backend\nnpm run dev\n\nIt should listen on port 4000 (Vite proxies /api there)."
        );
        setCompanies([]);
        setDeals([]);
        return;
      }
      if (health.mongo === "disconnected") {
        setErr(
          "API is running but MongoDB is not connected. Create backend/.env from .env.example, set MONGODB_URI (MongoDB Atlas is free), restart npm run dev, and allow your IP in Atlas Network Access."
        );
        setCompanies([]);
        setDeals([]);
        return;
      }
      const [c, d] = await Promise.all([fetchCompanies(), fetchDeals(10)]);
      setCompanies(c);
      setDeals(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scoreChartData = useMemo(
    () =>
      [...companies]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .map((c) => ({
          name: c.symbol,
          score: c.score ?? 0,
          growth: (c.growthRate ?? 0) * 100,
        })),
    [companies]
  );

  const growthRevenueData = useMemo(
    () =>
      companies.map((c) => ({
        symbol: c.symbol,
        growthPct: (c.growthRate ?? 0) * 100,
        revenueB: c.revenue != null ? c.revenue / 1e9 : 0,
      })),
    [companies]
  );

  async function onSync() {
    const symbols = syncInput
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (!symbols.length) return;
    setBusy(true);
    setErr(null);
    try {
      await syncSymbols(symbols);
      await runAnalyze();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRescore() {
    setBusy(true);
    setErr(null);
    try {
      await runAnalyze();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  const explainCompany = explainOpen
    ? (companies.find((c) => c.symbol === explainOpen) ??
       deals.find((c) => c.symbol === explainOpen))
    : null;

  async function openExplain(symbol: string) {
    setExplainOpen(symbol);
    setThesis(null);
    setDataQuality(null);
    setExplainLoading(true);
    try {
      const r = await explainSymbol(symbol);
      setThesis(r.thesis);
      setDataQuality(r.dataQuality);
    } catch (e) {
      setThesis({ strategic: e instanceof Error ? e.message : "Could not load thesis", financial: "" });
    } finally {
      setExplainLoading(false);
    }
  }

  return (
    <div className="min-h-screen font-sans text-slate-100">
      <header className="border-b border-white/10 bg-ink-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold-500">
              M&amp;A Intelligence
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              DealFlow AI
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Rank acquisition targets from fundamentals, Alpha Vantage data,
              and an institutional-style score. Explain theses with Claude.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {watchlist.length > 0 && token && (
              <button
                type="button"
                onClick={() => setWatchlistOpen((o) => !o)}
                className="rounded-lg border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-medium text-gold-400 transition hover:bg-gold-500/20"
              >
                ★ Watchlist ({watchlist.length}){watchlistSyncing ? " …" : ""}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => load()}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRescore}
              className="rounded-lg border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-medium text-gold-400 transition hover:bg-gold-500/20 disabled:opacity-50"
            >
              Run scoring
            </button>
            {/* Auth icon — rightmost */}
            {token ? (
              <div className="flex items-center gap-2">
                <span
                  title={email ?? undefined}
                  className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-slate-400"
                >
                  <i className="fas fa-user-circle text-gold-400" />
                  {email}
                </span>
                <button
                  type="button"
                  title="Sign out"
                  onClick={logout}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 transition hover:bg-red-900/30 hover:text-red-400"
                >
                  <i className="fas fa-sign-out-alt" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                title="Sign in / Register"
                onClick={() => setAuthOpen(true)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
              >
                <i className="fas fa-user-circle" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10">
        {/* ── Auth gate ── */}
        {!token && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <div className="rounded-2xl border border-white/10 bg-ink-900/80 p-10 shadow-2xl max-w-md w-full">
              <i className="fas fa-user-circle text-5xl text-gold-400 mb-4" />
              <h2 className="text-2xl font-semibold text-white mb-2">Sign in to DealFlow AI</h2>
              <p className="text-sm text-slate-400 mb-6">
                Create a free account to access deal scoring, watchlists, and
                AI-powered acquisition theses.
              </p>
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="w-full rounded-xl bg-gold-500 px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-gold-400"
              >
                <i className="fas fa-sign-in-alt mr-2" />
                Sign in / Create account
              </button>
            </div>
          </div>
        )}

        {token && err && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200 whitespace-pre-line">
            {err}
          </div>
        )}

        {token && (<>

        {/* Watchlist panel */}
        {watchlistOpen && watchlist.length > 0 && (
          <section className="rounded-2xl border border-gold-500/20 bg-gold-500/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gold-400 uppercase tracking-wide">
                  Watchlist
                </h2>
                {!token && (
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    <button
                      type="button"
                      onClick={() => setAuthOpen(true)}
                      className="text-gold-500 hover:underline"
                    >
                      Sign in
                    </button>{" "}
                    to sync across devices
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setWatchlistOpen(false)}
                className="text-slate-500 hover:text-white text-xs"
              >
                Hide
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {watchlist.map((c) => (
                <div
                  key={c.symbol}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-ink-900/60 px-4 py-3"
                >
                  <div>
                    <Link
                      to={`/company/${c.symbol}`}
                      className="font-mono font-semibold text-gold-400 hover:underline"
                    >
                      {c.symbol}
                    </Link>
                    <p className="text-xs text-slate-400 truncate max-w-[140px]">{c.name}</p>
                    <p className="font-mono text-xs text-slate-500 mt-0.5">
                      Score: {c.score?.toFixed(3) ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => openExplain(c.symbol)}
                      className="text-[11px] text-gold-500 hover:underline"
                    >
                      Thesis
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.symbol)}
                      className="text-[11px] text-slate-600 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* Basket scenario — only for signed-in users whose watchlist is server-backed */}
            <BasketScenarioPanel />
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-6 shadow-xl shadow-black/40">
          <h2 className="text-lg font-semibold text-white">Ingest &amp; score</h2>
          <p className="mt-1 text-sm text-slate-400">
            Sync tickers from Alpha Vantage (free tier is rate-limited — use
            small batches).
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="w-full flex-1 rounded-lg border border-white/10 bg-ink-950 px-3 py-2 font-mono text-sm text-white outline-none ring-gold-500/30 focus:ring-2"
              value={syncInput}
              onChange={(e) => setSyncInput(e.target.value)}
              placeholder="MSFT,AAPL,..."
            />
            <button
              type="button"
              disabled={busy}
              onClick={onSync}
              className="rounded-lg bg-gradient-to-r from-gold-600 to-gold-500 px-5 py-2 text-sm font-semibold text-ink-950 shadow-lg shadow-gold-900/20 transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Working…" : "Sync and analyze"}
            </button>
          </div>
        </section>

        <section>
          <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Top deals</h2>
              <p className="mt-1 text-xs text-slate-500">
                Ranked by model score (highest first). #1 is the strongest target vs. this
                heuristic — not a buy recommendation.
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 shrink-0">
              score = growth×0.4 + margin×0.3 − debt×0.3
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {loading ? (
              <p className="text-slate-500">Loading…</p>
            ) : deals.length === 0 ? (
              <p className="col-span-full text-slate-500">
                No deals yet. Sync symbols above to populate targets.
              </p>
            ) : (
              deals.map((c, i) => (
                <article
                  key={c._id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-800/80 to-ink-950 p-5 shadow-lg transition hover:border-gold-500/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-gold-500">
                        Rank {i + 1}
                        {deals.length > 0 ? ` of ${deals.length}` : ""}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold">
                        <Link
                          to={`/company/${c.symbol}`}
                          className="text-white hover:text-gold-300 transition"
                        >
                          {c.symbol}
                        </Link>
                      </h3>
                      <p className="text-sm text-slate-400">{c.name}</p>
                      {c.lastSyncedAt && (
                        <p className="mt-0.5 text-[10px] text-slate-600 font-mono">
                          AV OVERVIEW ·{" "}
                          {new Date(c.lastSyncedAt).toLocaleDateString()}
                          <NullFieldsBadge fields={c.nullFields} />
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-2xl font-semibold text-gold-400">
                        {(c.score ?? 0).toFixed(3)}
                      </p>
                      <p className="text-xs text-slate-500">score</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-500">Growth</dt>
                      <dd className="font-mono text-slate-200">
                        {pct(c.growthRate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Margin</dt>
                      <dd className="font-mono text-slate-200">
                        {pct(c.profitMargin)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Revenue</dt>
                      <dd className="font-mono text-slate-200">
                        {fmtBillions(c.revenue)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">D/E</dt>
                      <dd className="font-mono text-slate-200">
                        {c.debtToEquity != null
                          ? c.debtToEquity.toFixed(2)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openExplain(c.symbol)}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-medium text-gold-400 transition hover:border-[#E5A73B]/40 hover:bg-[#E5A73B]/15 hover:text-[#E5A73B]"
                    >
                      Thesis
                    </button>
                    <Link
                      to={`/company/${c.symbol}`}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-400 transition hover:border-[#4A90E2]/40 hover:bg-[#4A90E2]/15 hover:text-[#4A90E2]"
                    >
                      Detail →
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <DealCharts
          scoreChartData={scoreChartData}
          growthRevenueData={growthRevenueData}
        />

        <section className="rounded-2xl border border-white/10 bg-ink-900/40 overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4">
            <h3 className="text-lg font-semibold text-white">Universe</h3>
            <p className="text-sm text-slate-500">
              All synced companies — sorted by score (high → low).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-ink-950/50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Symbol</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Growth</th>
                  <th className="px-5 py-3 font-medium">Margin</th>
                  <th className="px-5 py-3 font-medium">Revenue</th>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr
                    key={c._id}
                    className="border-b border-white/5 hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3 font-mono font-medium text-gold-400">
                      <Link to={`/company/${c.symbol}`} className="hover:underline">
                        {c.symbol}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-300">{c.name}</td>
                    <td className="px-5 py-3 font-mono">
                      {(c.score ?? 0).toFixed(3)}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-400">
                      {pct(c.growthRate)}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-400">
                      {pct(c.profitMargin)}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-400">
                      {fmtBillions(c.revenue)}
                    </td>
                    <td className="px-5 py-3 text-[11px] text-slate-600 font-mono">
                      {c.lastSyncedAt
                        ? new Date(c.lastSyncedAt).toLocaleDateString()
                        : "—"}
                      <NullFieldsBadge fields={c.nullFields} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openExplain(c.symbol)}
                          className="text-xs font-medium text-gold-500 hover:underline"
                        >
                          Thesis
                        </button>
                        <Link
                          to={`/company/${c.symbol}`}
                          className="text-xs font-medium text-slate-400 hover:underline"
                        >
                          Detail
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>)}
      </main>

      {token && explainOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={() => setExplainOpen(null)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-500">
                  Acquisition thesis
                </p>
                <h4 className="mt-1 text-xl font-semibold tracking-tight text-white">
                  {explainOpen}
                  {explainCompany?.name && (
                    <span className="ml-2 text-sm font-normal text-slate-400">
                      {explainCompany.name}
                    </span>
                  )}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Figures match the synced fact pattern. Narrative is illustrative — not investment advice.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExplainOpen(null)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="mt-5">
              <DualThesisPanel
                thesis={thesis}
                dataQuality={dataQuality}
                symbol={explainOpen}
                loading={explainLoading}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Link
                to={`/company/${explainOpen}`}
                onClick={() => setExplainOpen(null)}
                className="text-xs text-gold-500 hover:underline"
              >
                Open full detail page →
              </Link>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-600">
        DealFlow AI · Educational demo · Not investment advice
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
