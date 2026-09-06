// Tiny in-process TTL cache for read-only endpoints.
// Keyed by officer id so one user can never see another user's data.
// Note: lives per Vercel instance; readers hit it only while the
// function stays warm — the bounded TTL keeps it safe and simple.

const store = new Map();
const DEFAULT_TTL_MS = 20_000;

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.t >= entry.ttl) {
    store.delete(key);
    return undefined;
  }
  return entry.v;
}

export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { t: Date.now(), ttl: ttlMs, v: value });
}

export function cacheDelPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheKey(parts) {
  return parts.join(":");
}