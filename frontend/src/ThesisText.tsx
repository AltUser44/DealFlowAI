import { useState } from "react";
import type { DataQuality, DualThesis } from "./api";

/** Renders thesis body as spaced paragraphs (plain text from API, no markdown). */
export function ThesisText({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim().replace(/\n/g, " "))
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return <p className="text-slate-500">No content.</p>;
  }

  return (
    <div className="space-y-4 text-[15px] leading-[1.65] text-slate-200">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-justify [text-wrap:pretty]">
          {para}
        </p>
      ))}
    </div>
  );
}

/** Data quality badge bar showing nulls and timestamp. */
export function DataQualityBar({ dq, symbol }: { dq: DataQuality; symbol: string }) {
  const syncDate = dq.lastSyncedAt
    ? new Date(dq.lastSyncedAt).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "never";

  return (
    <div className="mt-4 rounded-lg border border-white/5 bg-ink-950/60 px-4 py-3 text-xs text-slate-500 space-y-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
        <span>
          <span className="text-slate-400">Source:</span>{" "}
          <span className="font-mono">{dq.source}</span>
          {dq.lastSyncedAt && (
            <>, as of <span className="font-mono">{syncDate}</span></>
          )}
        </span>
        <span>
          <span className="text-slate-400">Symbol:</span>{" "}
          <span className="font-mono text-gold-500">{symbol}</span>
        </span>
      </div>
      {dq.nullFields.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center pt-1">
          <span className="text-slate-600">Missing fields:</span>
          {dq.nullFields.map((f) => (
            <span
              key={f}
              className="rounded bg-amber-900/30 border border-amber-700/30 px-1.5 py-0.5 font-mono text-amber-400"
            >
              {f}
              {f === "debtToEquity" && (
                <span className="text-amber-600 ml-1">→ default D/E 0.35 burden used</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const TAB_LABELS: Record<keyof DualThesis, string> = {
  strategic: "Strategic",
  financial: "Financial",
};

/** Dual strategic/financial thesis with tabs + data quality footer. */
export function DualThesisPanel({
  thesis,
  dataQuality,
  symbol,
  loading,
}: {
  thesis: DualThesis | null;
  dataQuality: DataQuality | null;
  symbol: string;
  loading: boolean;
}) {
  const [tab, setTab] = useState<keyof DualThesis>("strategic");

  if (loading) {
    return <p className="text-slate-500">Generating thesis…</p>;
  }

  if (!thesis) return null;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10 mb-5">
        {(["strategic", "financial"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition ${
              tab === t
                ? "bg-gold-500/10 border border-white/10 border-b-transparent text-gold-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
        <div className="ml-auto flex items-center text-[11px] text-slate-600 pr-1">
          {tab === "strategic"
            ? "Synergies · market structure · antitrust (qualitative)"
            : "Margin · leverage · growth compounding · score"}
        </div>
      </div>

      {/* Thesis body */}
      <div className="border-l-2 border-gold-500/30 pl-5">
        <ThesisText text={thesis[tab]} />
      </div>

      {/* Data quality */}
      {dataQuality && <DataQualityBar dq={dataQuality} symbol={symbol} />}
    </div>
  );
}

