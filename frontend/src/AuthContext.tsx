import { createContext, useCallback, useContext, useState } from "react";
import { authLogin, authRegister } from "./api";

type AuthCtx = {
  token: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx>({
  token: null,
  email: null,
  login: async () => undefined,
  register: async () => undefined,
  logout: () => undefined,
});

const TOKEN_KEY = "dealflow_token";
const EMAIL_KEY = "dealflow_email";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [email, setEmail] = useState<string | null>(() =>
    localStorage.getItem(EMAIL_KEY)
  );

  const persist = useCallback((t: string, e: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(EMAIL_KEY, e);
    setToken(t);
    setEmail(e);
  }, []);

  const login = useCallback(
    async (e: string, p: string) => {
      const r = await authLogin(e, p);
      persist(r.token, r.email);
    },
    [persist]
  );

  const register = useCallback(
    async (e: string, p: string) => {
      const r = await authRegister(e, p);
      persist(r.token, r.email);
    },
    [persist]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setToken(null);
    setEmail(null);
  }, []);

  return (
    <Ctx.Provider value={{ token, email, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
