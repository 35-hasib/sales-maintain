import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Dealer } from "./types";
import { api } from "./api";

type Entry<T> = { t: number; v: T };

const mem = new Map<string, Entry<unknown>>();

function isFresh<T>(e: Entry<T> | undefined, ttlMs: number): e is Entry<T> {
  return !!e && Date.now() - e.t < ttlMs;
}

export async function getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = isFresh<T>(mem.get(key) as Entry<T> | undefined, ttlMs)
    ? (mem.get(key) as Entry<T>).v
    : undefined;
  if (cached !== undefined) return cached;

  const stored = await AsyncStorage.getItem(key);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Entry<T>;
      if (parsed && Number.isFinite(parsed.t) && parsed.v !== undefined && Date.now() - parsed.t < ttlMs) {
        mem.set(key, parsed as unknown as Entry<unknown>);
        return parsed.v;
      }
    } catch {}
  }

  const value = await fetcher();
  const entry: Entry<T> = { t: Date.now(), v: value };
  mem.set(key, entry as unknown as Entry<unknown>);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {}
  return value;
}

export function invalidate(key: string) {
  mem.delete(key);
  AsyncStorage.removeItem(key).catch(() => {});
}

export function clearAppCache() {
  mem.clear();
  AsyncStorage.multiRemove(["salesmaintain_dealers", "salesmaintain_dashboard"]).catch(() => {});
}

const DEALERS_KEY = "salesmaintain_dealers";
const DEALERS_TTL = 60_000;

export function getDealers(): Promise<Dealer[]> {
  return getCached<Dealer[]>(DEALERS_KEY, DEALERS_TTL, async () => {
    const d = await api.get<{ dealers: Dealer[] }>("/api/dealers?pageSize=1000");
    return d.dealers;
  });
}

export function invalidateDealers() {
  invalidate(DEALERS_KEY);
}

const DASHBOARD_KEY = "salesmaintain_dashboard";
const DASHBOARD_TTL = 30_000;

export function getDashboard<T>(): Promise<T> {
  return getCached<T>(DASHBOARD_KEY, DASHBOARD_TTL, () => api.get<T>("/api/dashboard"));
}

export function invalidateDashboard() {
  invalidate(DASHBOARD_KEY);
}