import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "salesmaintain_token";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "";

let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}
export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class ApiTimeoutError extends Error {}
export class ApiNetworkError extends Error {}

const REQUEST_TIMEOUT_MS = 30000;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE) {
    throw new Error(
      "API_BASE is empty — set EXPO_PUBLIC_API_BASE before building (see eas.json / .env)."
    );
  }
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
  } catch (e: any) {
    throw e?.name === "AbortError"
      ? new ApiTimeoutError("সার্ভার থেকে উত্তর পেতে সময় বেশি লাগছে। আবার চেষ্টা করুন।")
      : new ApiNetworkError("সংযোগ ব্যর্থ হয়েছে। ইন্টারনেট সংযোগ চেক করুন।");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    await clearToken();
    if (unauthorizedHandler) unauthorizedHandler();
  }

  if (!res.ok) {
    let message = "কিছু ভুল হয়েছে";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {}
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
