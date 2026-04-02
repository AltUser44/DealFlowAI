import { useState } from "react";
import type { BasketScenarioItem } from "./api";
import { runBasketScenario } from "./api";
import { useAuth } from "./AuthContext";

function fmt3(n: number) { return n.toFixed(3); }
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.0005) return <span className="text-slate-500">±0.000</span>;
  return (
    <span className={delta > 0 ? "text-emerald-400" : "text-red-400"}>
      {delta > 0 ? "+" : ""}{fmt3(delta)}
    </span>
  );
}

export function BasketScenarioPanel() {
  const { token } = useAuth();
  const [growthDelta, setGrowthDelta] = useState("0");
  const [marginDelta, setMarginDelta] = useState("0");
  const [deDelta, setDeDelta] = useState("0");
  const [results, setResults] = useState<BasketScenarioItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!token) return null;

  async function onRun() {
    if (!token) return;
    const gd = parseFloat(growthDelta) / 100;
    const md = parseFloat(marginDelta) / 100;
    const de = parseFloat(deDelta);
    if (!Number.isFinite(gd) || !Number.isFinite(md) || !Number.isFinite(de)) {
      setErr("Enter valid numbers for all fields.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await runBasketScenario(token, gd, md, de);
      setResults(r.results);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Scenario failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-ink-950/60 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
        Basket Scenario
      </h3>
      <p className="text-[11px] text-slate-600 mb-3">
        Apply a shock to every watchlist target and rerank — nothing is saved.
      </p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "Growth Δ (pp)", value: growthDelta, set: setGrowthDelta, hint: "e.g. −5" },
          { label: "Margin Δ (pp)", value: marginDelta, set: setMarginDelta, hint: "e.g. −5" },
          { label: "D/E Δ", value: deDelta, set: setDeDelta, hint: "e.g. 1.0" },
        ].map(({ label, value, set, hint }) => (
          <div key={label}>
            <label className="block text-[10px] text-slate-500 mb-1">{label}</label>
            <input
              type="number"
              step="0.1"
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={hint}
              className="w-full rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 font-mono text-xs text-white outline-none ring-gold-500/30 focus:ring-2"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onRun}
        className="rounded-lg bg-gradient-to-r from-gold-600 to-gold-500 px-4 py-1.5 text-xs font-semibold text-ink-950 transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Running…" : "Run basket scenario"}
      </button>

      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}

      {results && results.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wide text-slate-600">
                <th className="pb-2 pr-3">Rank</th>
                <th className="pb-2 pr-3">Symbol</th>
                <th className="pb-2 pr-3">Base</th>
                <th className="pb-2 pr-3">Scenario</th>
                <th className="pb-2 pr-3">Δ</th>
                <th className="pb-2 pr-3">Growth</th>
                <th className="pb-2">Margin</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.symbol} className="border-b border-white/5">
                  <td className="py-1.5 pr-3 text-slate-600">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-mono font-semibold text-gold-400">{r.symbol}</td>
                  <td className="py-1.5 pr-3 font-mono text-slate-400">{fmt3(r.baseScore)}</td>
                  <td className="py-1.5 pr-3 font-mono text-white">{fmt3(r.scenarioScore)}</td>
                  <td className="py-1.5 pr-3 font-mono"><DeltaBadge delta={r.delta} /></td>
                  <td className="py-1.5 pr-3 font-mono text-slate-400">{pct(r.inputs.growthRate)}</td>
                  <td className="py-1.5 font-mono text-slate-400">{pct(r.inputs.profitMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results && results.length === 0 && (
        <p className="mt-3 text-xs text-slate-600">
          Add synced companies to your watchlist first.
        </p>
      )}
    </div>
  );
}
