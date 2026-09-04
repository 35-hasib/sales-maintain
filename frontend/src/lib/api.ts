const TOKEN_KEY = "salesmaintain_token";
const API_BASE = import.meta.env.VITE_API_BASE || "";

type LoadingListener = (pending: number) => void;
const listeners = new Set<LoadingListener>();
let pendingRequests = 0;

export function subscribeLoading(listener: LoadingListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitLoading() {
  listeners.forEach((listener) => listener(pendingRequests));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  pendingRequests++;
  emitLoading();
  try {
    const token = getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
      clearToken();
      if (!path.startsWith("/api/auth/login")) {
        window.location.href = "/login";
      }
    }

    if (!res.ok) {
      let message = "কিছু ভুল হয়েছে";
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
      } catch {
        /* noop */
      }
      throw new ApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    pendingRequests--;
    emitLoading();
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
