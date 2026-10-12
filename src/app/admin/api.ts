// Admin fetch helper. The token lives in sessionStorage only (this tab), sent as x-admin-token.
const TOKEN_KEY = "sos:admin-token";

export function loadToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: token stays in memory only */
  }
}

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function adminFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-admin-token", token);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AdminError(j?.error || `Request failed (${res.status})`, res.status);
  }
  return res;
}

export async function adminJson<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await adminFetch(token, url, init);
  return (await res.json()) as T;
}
