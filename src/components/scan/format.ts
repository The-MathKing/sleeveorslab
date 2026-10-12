// Small formatting + client-fetch helpers for the app flows.
import type { CardRef, PriceQuote, Prediction } from "@/lib/types";

export function usd(n: number | undefined, opts: { sign?: boolean; cents?: boolean } = {}): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const cents = opts.cents ?? abs < 100;
  const s = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  if (n < 0) return `−${s}`;
  return opts.sign && n > 0 ? `+${s}` : s;
}

export function pct(p: number | undefined, digits = 0): string {
  if (p === undefined || !Number.isFinite(p)) return "—";
  return `${(p * 100).toFixed(digits)}%`;
}

export function shortDate(iso: string): string {
  try {
    // Date-only strings ("2026-10-12") are calendar dates; don't shift them by timezone.
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    return new Date(dateOnly ? `${iso}T12:00:00` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function stamp(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
  } catch {
    return iso;
  }
}

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export async function searchCards(q: string, limit = 12, signal?: AbortSignal): Promise<CardRef[]> {
  const r = await getJSON<{ cards: CardRef[] }>(
    `/api/cards/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    { signal },
  );
  return r.cards ?? [];
}

export async function fetchPrice(cardId: string, signal?: AbortSignal): Promise<PriceQuote> {
  const r = await getJSON<{ price: PriceQuote }>(`/api/prices/${encodeURIComponent(cardId)}`, { signal });
  return r.price;
}

export async function postPrediction(p: Omit<Prediction, "id" | "createdAt">): Promise<Prediction> {
  const r = await getJSON<{ prediction: Prediction }>("/api/predictions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(p),
  });
  return r.prediction;
}

export async function listPredictionsApi(limit = 200, signal?: AbortSignal): Promise<Prediction[]> {
  const r = await getJSON<{ predictions: Prediction[] }>(`/api/predictions?limit=${limit}`, { signal });
  return r.predictions ?? [];
}

export async function joinWaitlist(email: string, source: string, consentMarketing: boolean) {
  return getJSON<{ ok: boolean; duplicate: boolean; count: number }>("/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, source, consentMarketing }),
  });
}

/** Run async tasks with a concurrency cap. */
export async function pool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

export function shareUrl(params: { saved?: number; cards?: number; verdict?: string; name?: string; format?: "og" }) {
  const sp = new URLSearchParams();
  if (params.saved !== undefined) sp.set("saved", String(Math.max(0, Math.round(params.saved))));
  if (params.cards !== undefined) sp.set("cards", String(params.cards));
  if (params.verdict) sp.set("verdict", params.verdict);
  if (params.name) sp.set("name", params.name.slice(0, 60));
  if (params.format) sp.set("format", params.format);
  return `/api/share?${sp.toString()}`;
}

/** Try the Web Share API with the PNG attached; fall back to opening the image. */
export async function shareImage(url: string, text: string): Promise<"shared" | "opened" | "cancelled"> {
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], "sleeve-or-slab.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return "shared";
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      }
      try {
        await navigator.share({ text, url: new URL(url, location.origin).toString() });
        return "shared";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      }
    }
  } catch {
    /* fall through */
  }
  window.open(url, "_blank", "noopener");
  return "opened";
}
