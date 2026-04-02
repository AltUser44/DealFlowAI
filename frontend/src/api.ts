const base = import.meta.env.VITE_API_URL ?? "";

export type CompanyRow = {
  _id: string;
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
  growthRate?: number;
  profitMargin?: number;
  debtToEquity?: number;
  debtScore?: number;
  score?: number;
  lastSyncedAt?: string;
  nullFields?: string[];
};

export type DataQuality = {
  lastSyncedAt?: string;
  nullFields: string[];
  source: string;
};

export type DualThesis = {
  strategic: string;
  financial: string;
};

export type ExplainResult = {
  symbol: string;
  explanation: string;
  thesis: DualThesis;
  dataQuality: DataQuality;
};

export type ScenarioResult = {
  symbol: string;
  score: number;
  inputs: { growthRate: number; profitMargin: number; debtToEquity?: number; debtScore: number };
};

export type BasketScenarioItem = {
  symbol: string;
  name: string;
  baseScore: number;
  scenarioScore: number;
  delta: number;
  inputs: { growthRate: number; profitMargin: number; debtToEquity: number | null };
};

export type AuthResult = { token: string; email: string };

/** True if the API process is up (Vite proxy can reach port 4000). */
export async function fetchHealth(): Promise<{ ok: boolean; mongo?: string }> {
  try {
    const res = await fetch(`${base}/health`, { method: "GET" });
    if (!res.ok) return { ok: false };
    return (await res.json()) as { ok: boolean; mongo?: string };
  } catch {
    return { ok: false };
  }
}

/** Build fetch init with optional Bearer token. */
function authInit(token: string | null, extra?: RequestInit): RequestInit {
  return {
    ...extra,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extra?.headers ?? {}),
    },
  };
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      (err as { error?: string }).error ||
      (res.status === 500 ? "Internal Server Error" : res.statusText);
    if (res.status === 503) throw new Error(msg);
    if (res.status === 500 && msg === "Internal Server Error") {
      throw new Error(
        "Cannot reach the API (is the backend running on port 4000?). In a second terminal: cd backend && npm run dev"
      );
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Public company/deal endpoints ─────────────────────────────────────────────

export async function fetchCompanies(): Promise<CompanyRow[]> {
  const data = await json<{ companies: CompanyRow[] }>("/api/companies");
  return data.companies;
}

export async function fetchCompany(symbol: string): Promise<CompanyRow> {
  const data = await json<{ company: CompanyRow }>(`/api/companies/${encodeURIComponent(symbol)}`);
  return data.company;
}

export async function fetchDeals(limit = 10): Promise<CompanyRow[]> {
  const data = await json<{ deals: CompanyRow[] }>(`/api/deals?limit=${limit}`);
  return data.deals;
}

export async function syncSymbols(symbols: string[]) {
  return json<{ results: { symbol: string; ok: boolean; error?: string }[] }>(
    "/api/companies/sync",
    { method: "POST", body: JSON.stringify({ symbols }) }
  );
}

export async function runAnalyze(symbol?: string) {
  return json<{ rescored?: number; companies?: CompanyRow[]; company?: CompanyRow }>(
    "/api/analyze",
    { method: "POST", body: JSON.stringify(symbol ? { symbol } : {}) }
  );
}

export async function explainSymbol(symbol: string): Promise<ExplainResult> {
  return json<ExplainResult>("/api/explain", {
    method: "POST",
    body: JSON.stringify({ symbol }),
  });
}

export async function scoreScenario(
  symbol: string,
  growthRate: number,
  profitMargin: number,
  debtToEquity?: number
): Promise<ScenarioResult> {
  return json<ScenarioResult>("/api/score", {
    method: "POST",
    body: JSON.stringify({ symbol, growthRate, profitMargin, debtToEquity }),
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function authRegister(email: string, password: string): Promise<AuthResult> {
  return json<AuthResult>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function authLogin(email: string, password: string): Promise<AuthResult> {
  return json<AuthResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ── Watchlist (authenticated) ─────────────────────────────────────────────────

export async function fetchWatchlist(
  token: string
): Promise<{ watchlist: string[]; companies: CompanyRow[] }> {
  return json("/api/watchlist", authInit(token));
}

export async function addToWatchlist(token: string, symbol: string): Promise<void> {
  await json("/api/watchlist", authInit(token, {
    method: "POST",
    body: JSON.stringify({ symbol }),
  }));
}

export async function removeFromWatchlist(token: string, symbol: string): Promise<void> {
  await json(`/api/watchlist/${encodeURIComponent(symbol)}`, authInit(token, { method: "DELETE" }));
}

export async function runBasketScenario(
  token: string,
  growthDelta: number,
  marginDelta: number,
  deDelta: number
): Promise<{ results: BasketScenarioItem[]; assumptions: { growthDelta: number; marginDelta: number; deDelta: number } }> {
  return json("/api/watchlist/scenario", authInit(token, {
    method: "POST",
    body: JSON.stringify({ growthDelta, marginDelta, deDelta }),
  }));
}
