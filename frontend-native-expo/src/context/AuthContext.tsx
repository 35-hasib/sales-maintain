import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, getToken, setToken, clearToken } from "../lib/api";

type Officer = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AuthState = {
  officer: Officer | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Officer>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export type { Officer };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then((token) => {
      if (!token) {
        setLoading(false);
        return;
      }
      api
        .get<{ officer: Officer }>("/api/auth/me")
        .then((d) => setOfficer(d.officer))
        .catch(() => clearToken())
        .finally(() => setLoading(false));
    });
  }, []);

  async function login(email: string, password: string): Promise<Officer> {
    const d = await api.post<{ token: string; officer: Officer }>("/api/auth/login", {
      email,
      password,
    });
    await setToken(d.token);
    setOfficer(d.officer);
    return d.officer;
  }

  function logout() {
    clearToken();
    setOfficer(null);
  }

  return (
    <AuthContext.Provider value={{ officer, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
