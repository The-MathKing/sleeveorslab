// Browser-side event counting. First-party and cookieless:
// - identity is a random per-tab visit id in sessionStorage (gone when the tab closes);
// - no cookies, no localStorage, no fingerprinting; the server stores no IP or user agent;
// - Do Not Track and Global Privacy Control turn it off entirely (nothing is sent).
// Every call is fire-and-forget and can never throw or block the UI.
import type { EventName, EventPropsMap } from "./types";

const ENDPOINT = "/api/events";
const VISIT_KEY = "sos:visit";
const REF_KEY = "sos:ref-sent";

let memoryVisit: string | null = null;
let memoryRefSent = false;

type Nav = Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };

export function trackingDisabled(): boolean {
  try {
    if (typeof window === "undefined" || typeof navigator === "undefined") return true;
    const n = navigator as Nav;
    const w = window as Window & { doNotTrack?: string };
    return n.doNotTrack === "1" || w.doNotTrack === "1" || n.msDoNotTrack === "1" || n.globalPrivacyControl === true;
  } catch {
    return true;
  }
}

function randomId(): string {
  try {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 24).padEnd(12, "0");
  }
}

function visitId(): string {
  try {
    const existing = sessionStorage.getItem(VISIT_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,40}$/.test(existing)) return existing;
    const id = randomId();
    sessionStorage.setItem(VISIT_KEY, id);
    return id;
  } catch {
    // sessionStorage blocked: keep an in-memory id for this page load only.
    return (memoryVisit ??= randomId());
  }
}

function send(body: string): void {
  try {
    if (typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    /* never throw */
  }
}

type PropsArg<N extends EventName> = keyof EventPropsMap[N] extends never ? [] : [props: EventPropsMap[N]];

/** Count one event. Props are a closed, small set per event (see types.ts). */
export function track<N extends EventName>(name: N, ...args: PropsArg<N>): void {
  try {
    if (trackingDisabled()) return;
    const props = args[0];
    const payload: Record<string, unknown> = { name, visitId: visitId() };
    if (props && Object.keys(props).length) payload.props = props;
    send(JSON.stringify(payload));
  } catch {
    /* never throw */
  }
}

const tokenize = (s: string, max: number) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, max);

/** Coarse source: "qr" for ?from=qr, else utm_source, else the referring site's hostname. */
export function coarseRef(): string | undefined {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "qr") return "qr";
    const utm = params.get("utm_source");
    if (utm) {
      const t = tokenize(utm, 40);
      if (t) return t;
    }
    if (!document.referrer) return undefined;
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (!host || host === window.location.hostname.replace(/^www\./, "")) return undefined;
    return tokenize(host, 64) || undefined;
  } catch {
    return undefined;
  }
}

/** page_view for a route; the source (ref) is sent once per visit, on its first page view. */
export function trackPageView(path: string): void {
  try {
    if (trackingDisabled()) return;
    const clean = (path || "/").replace(/[^A-Za-z0-9/_.-]/g, "").slice(0, 120) || "/";
    let refSent = memoryRefSent;
    try {
      refSent = sessionStorage.getItem(REF_KEY) === "1";
    } catch {
      /* use memory flag */
    }
    const props: EventPropsMap["page_view"] = { path: clean.startsWith("/") ? clean : `/${clean}` };
    if (!refSent) {
      const ref = coarseRef();
      if (ref) props.ref = ref;
      memoryRefSent = true;
      try {
        sessionStorage.setItem(REF_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    track("page_view", props);
  } catch {
    /* never throw */
  }
}

/** Waitlist sources are free-ish strings; reduce to a short token before counting. */
export function sourceToken(source: string | undefined): string {
  return tokenize(source || "unknown", 40) || "unknown";
}
