import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, getToken, setToken, clearToken, setUnauthorizedHandler, ApiError } from "../lib/api";
import { clearAppCache } from "../lib/cache";

type Officer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
};

type AuthState = {
  officer: Officer | null;
  loading: boolean;
  startupError: string | null;
  retryStartup: () => void;
  login: (identifier: string, password: string) => Promise<Officer>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export type { Officer };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    const onUnauthorized = () => setOfficer(null);
    setUnauthorizedHandler(onUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, []);

  const restore = useCallback(async () => {
    setLoading(true);
    setStartupError(null);
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const d = await api.get<{ officer: Officer }>("/api/auth/me");
      setOfficer(d.officer);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
      } else {
        setStartupError(e?.message || "সংযোগ সমস্যা হয়েছে।");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  async function login(identifier: string, password: string): Promise<Officer> {
    const d = await api.post<{ token: string; officer: Officer }>("/api/auth/login", {
      identifier,
      password,
    });
    await setToken(d.token);
    setOfficer(d.officer);
    return d.officer;
  }

  const logout = useCallback(() => {
    clearAppCache();
    clearToken();
    setOfficer(null);
  }, []);

  return (
    <AuthContext.Provider value={{ officer, loading, startupError, retryStartup: restore, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
