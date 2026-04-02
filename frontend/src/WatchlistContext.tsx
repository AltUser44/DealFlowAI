import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CompanyRow } from "./api";
import {
  addToWatchlist,
  fetchWatchlist,
  removeFromWatchlist,
} from "./api";
import { useAuth } from "./AuthContext";

type WatchlistCtx = {
  watchlist: CompanyRow[];
  syncing: boolean;
  add: (c: CompanyRow) => Promise<void>;
  remove: (symbol: string) => Promise<void>;
  has: (symbol: string) => boolean;
};

const Ctx = createContext<WatchlistCtx>({
  watchlist: [],
  syncing: false,
  add: async () => undefined,
  remove: async () => undefined,
  has: () => false,
});

const LS_KEY = "dealflow_watchlist";

function lsLoad(): CompanyRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CompanyRow[]) : [];
  } catch { return []; }
}

function lsSave(list: CompanyRow[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [watchlist, setWatchlist] = useState<CompanyRow[]>(lsLoad);
  const [syncing, setSyncing] = useState(false);

  // When token changes (login/logout), sync from server or fall back to local
  useEffect(() => {
    if (!token) {
      setWatchlist(lsLoad());
      return;
    }
    setSyncing(true);
    fetchWatchlist(token)
      .then(({ companies }) => setWatchlist(companies as CompanyRow[]))
      .catch(() => { /* keep local state on network error */ })
      .finally(() => setSyncing(false));
  }, [token]);

  const add = useCallback(
    async (c: CompanyRow) => {
      setWatchlist((prev) => {
        if (prev.some((x) => x.symbol === c.symbol)) return prev;
        const next = [...prev, c];
        if (!token) lsSave(next);
        return next;
      });
      if (token) {
        try { await addToWatchlist(token, c.symbol); }
        catch { /* optimistic — ignore transient errors */ }
      }
    },
    [token]
  );

  const remove = useCallback(
    async (symbol: string) => {
      setWatchlist((prev) => {
        const next = prev.filter((x) => x.symbol !== symbol);
        if (!token) lsSave(next);
        return next;
      });
      if (token) {
        try { await removeFromWatchlist(token, symbol); }
        catch { /* optimistic */ }
      }
    },
    [token]
  );

  const has = useCallback(
    (symbol: string) => watchlist.some((x) => x.symbol === symbol),
    [watchlist]
  );

  return (
    <Ctx.Provider value={{ watchlist, syncing, add, remove, has }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWatchlist() {
  return useContext(Ctx);
}
