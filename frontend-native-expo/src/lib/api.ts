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
// Cold-start requests on serverless hosts can exceed the first attempt's
// budget, but succeed on a warm retry. Retry GETs (idempotent) with backoff.
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

async function fetchOnce(
  path: string,
  options: RequestInit,
  headers: Record<string, string>
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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

  const retriable = !options.method || options.method === "GET";
  let res: Response;

  for (let attempt = 0; ; attempt++) {
    let timedOut = false;
    try {
      res = await fetchOnce(path, options, headers);
    } catch (e: any) {
      timedOut = e?.name === "AbortError";
      // Both timeouts and generic network failures are safe to retry for
      // idempotent GET requests — a cold start usually succeeds on retry.
      if (retriable && attempt < MAX_RETRIES) {
        await new Promise((done) => setTimeout(done, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      throw timedOut
        ? new ApiTimeoutError("সার্ভার থেকে উত্তর পেতে সময় বেশি লাগছে। আবার চেষ্টা করুন।")
        : new ApiNetworkError("সংযোগ ব্যর্থ হয়েছে। ইন্টারনেট সংযোগ চেক করুন।");
    }
    break;
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
