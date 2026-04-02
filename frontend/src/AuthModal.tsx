import { useState } from "react";
import { useAuth } from "./AuthContext";

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900 p-7 shadow-2xl">
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-500">
            DealFlow AI
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {mode === "login" ? "Sign in" : "Create account"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {mode === "login"
              ? "Sign in to sync your watchlist across devices."
              : "Register to persist your watchlist in the cloud."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none ring-gold-500/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Password {mode === "register" && <span className="text-slate-600">(min 8 chars)</span>}
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none ring-gold-500/30 focus:ring-2"
            />
          </div>

          {err && (
            <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-r from-gold-600 to-gold-500 py-2 text-sm font-semibold text-ink-950 shadow-lg shadow-gold-900/20 transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          {mode === "login" ? "No account?" : "Already registered?"}{" "}
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(null); }}
            className="text-gold-400 hover:underline"
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
