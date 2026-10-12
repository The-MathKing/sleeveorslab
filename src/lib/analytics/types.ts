// First-party, cookieless event counting: shared types and constants (no runtime deps,
// safe to import from client and server). See /privacy "Cookies and tracking".

export const EVENT_NAMES = [
  "page_view",
  "scan_started",
  "photo_captured",
  "camera_unavailable",
  "centering_done",
  "card_selected",
  "verdict_shown",
  "waitlist_signup",
  "prediction_logged",
  "share_clicked",
  "qr_shown",
  "binder_evaluated",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const PHOTO_METHODS = ["camera-auto", "camera-manual", "upload", "sample"] as const;
export type PhotoMethod = (typeof PHOTO_METHODS)[number];

type NoProps = Record<never, never>;

/** Props allowed per event. Small enums/strings/ints only: never free text, emails, or photos. */
export interface EventPropsMap {
  page_view: { path: string; ref?: string };
  scan_started: NoProps;
  photo_captured: { method: PhotoMethod };
  camera_unavailable: NoProps;
  centering_done: NoProps;
  card_selected: NoProps;
  verdict_shown: { verdict: "SLAB" | "SLEEVE" | "BORDERLINE"; grader: "PSA" | "CGC" };
  waitlist_signup: { source: string };
  prediction_logged: NoProps;
  share_clicked: NoProps;
  qr_shown: NoProps;
  binder_evaluated: { cards: number };
}

export type EventProps = Record<string, string | number>;

export interface AnalyticsEvent {
  name: EventName;
  visitId: string;
  props: EventProps;
  /** ISO timestamp, set by the server (client clocks aren't trusted). */
  at: string;
}

/** Raw events are deleted after this many days. */
export const EVENT_RETENTION_DAYS = 90;
/** Share of recordEvent calls that also purge expired events. */
export const PURGE_PROBABILITY = 0.01;

/** The launch funnel, counted as distinct visits that fired each event. */
export const FUNNEL_STEPS = ["page_view", "scan_started", "centering_done", "verdict_shown", "waitlist_signup"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const DIRECT_REF = "(direct)";

/** Intermediate aggregates each storage adapter computes; finalizeStats turns them into AnalyticsStats. */
export interface StatsRows {
  dailyCounts: Array<{ day: string; name: string; n: number }>;
  dailyVisits: Array<{ day: string; n: number }>;
  /** Distinct visits per (source, event) for funnel steps. Each visit has exactly one source. */
  sourceSteps: Array<{ ref: string; name: string; n: number }>;
  /** How many visits saw exactly `verdicts` verdicts (visits with ≥1 only). */
  verdictHist: Array<{ verdicts: number; visits: number }>;
  totalEvents: number;
  totalVisits: number;
  waitlistTotal: number;
  waitlistConsenting: number;
  predictionsTotal: number;
  predictionsResolved: number;
}

export interface AnalyticsStats {
  days: number;
  /** First UTC day included, yyyy-mm-dd. */
  since: string;
  generatedAt: string;
  totalEvents: number;
  totalVisits: number;
  daily: Array<{ day: string; visits: number; counts: Partial<Record<EventName, number>> }>;
  funnel: Array<{ step: FunnelStep; visits: number }>;
  funnelBySource: Array<{ ref: string; steps: Array<{ step: FunnelStep; visits: number }> }>;
  /** G1 "cards scanned per visitor": verdicts per visit, among visits that saw at least one. */
  verdictsPerVisit: {
    visits: number;
    median: number;
    mean: number;
    distribution: Array<{ bucket: string; visits: number }>;
  };
  topRefs: Array<{ ref: string; visits: number }>;
  waitlist: { total: number; consenting: number };
  predictions: { total: number; resolved: number };
}
