// Owned by app-flows. Browser-only local persistence (IndexedDB via idb-keyval) plus small
// localStorage helpers. Every storage access is wrapped: private windows, blocked site data and
// SSR must never crash a page — they just degrade to "nothing saved".
import { createStore, get, set, del, keys, getMany, type UseStore } from "idb-keyval";
import type { CardRef, CollectionItem } from "@/lib/types";

let _collection: UseStore | null = null;
let _kv: UseStore | null = null;

function collectionStore(): UseStore | null {
  if (typeof indexedDB === "undefined") return null;
  try {
    _collection ??= createStore("sos-collection", "items");
    return _collection;
  } catch {
    return null;
  }
}

function kvStore(): UseStore | null {
  if (typeof indexedDB === "undefined") return null;
  try {
    _kv ??= createStore("sos-kv", "kv");
    return _kv;
  } catch {
    return null;
  }
}

/* ---------------- Collection (contract) ---------------- */

export async function listCollection(): Promise<CollectionItem[]> {
  const store = collectionStore();
  if (!store) return [];
  try {
    const ks = await keys(store);
    const items = (await getMany<CollectionItem | undefined>(ks, store)).filter((x): x is CollectionItem => !!x);
    return items.sort((a, b) => (b.savedAt > a.savedAt ? 1 : b.savedAt < a.savedAt ? -1 : 0));
  } catch {
    return [];
  }
}

export async function saveToCollection(item: CollectionItem): Promise<void> {
  const store = collectionStore();
  if (!store) throw new Error("On-device storage isn't available in this browser.");
  await set(item.id, item, store);
}

export async function removeFromCollection(id: string): Promise<void> {
  const store = collectionStore();
  if (!store) return;
  try {
    await del(id, store);
  } catch {
    /* ignore */
  }
}

export async function getCollectionItem(id: string): Promise<CollectionItem | undefined> {
  const store = collectionStore();
  if (!store) return undefined;
  try {
    return await get<CollectionItem>(id, store);
  } catch {
    return undefined;
  }
}

/* ---------------- Binder (batch triage list) ---------------- */

export interface BinderEntry {
  key: string; // local unique key
  card: CardRef;
  /** 1..5, 5 = pack fresh. Undefined = not assessed. */
  condition?: number;
  addedAt: string;
}

const BINDER_KEY = "binder:v1";

export async function loadBinder(): Promise<BinderEntry[]> {
  const store = kvStore();
  if (!store) return [];
  try {
    return (await get<BinderEntry[]>(BINDER_KEY, store)) ?? [];
  } catch {
    return [];
  }
}

export async function saveBinder(entries: BinderEntry[]): Promise<void> {
  const store = kvStore();
  if (!store) return;
  try {
    await set(BINDER_KEY, entries, store);
  } catch {
    /* ignore */
  }
}

/* ---------------- localStorage helpers ---------------- */

function lsGet(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function ssGet(key: string): string | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function ssSet(key: string, value: string): void {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Free-tier soft limit. */
export const FREE_VERDICTS_PER_DAY = 3;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function verdictsToday(): number {
  const raw = lsGet("sos:verdicts");
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { day: string; n: number };
    return parsed.day === today() ? parsed.n : 0;
  } catch {
    return 0;
  }
}

/** Increments and returns the new count for today. */
export function countVerdict(): number {
  const n = verdictsToday() + 1;
  lsSet("sos:verdicts", JSON.stringify({ day: today(), n }));
  return n;
}

/** True once a verdict has been shown in this browser session. */
export function hadVerdictThisSession(): boolean {
  return ssGet("sos:had-verdict") === "1";
}
export function markVerdictThisSession(): void {
  ssSet("sos:had-verdict", "1");
}

export function waitlistJoined(): boolean {
  return lsGet("sos:waitlist") === "1";
}
export function markWaitlistJoined(): void {
  lsSet("sos:waitlist", "1");
}
export function waitlistDismissed(): boolean {
  return ssGet("sos:waitlist-dismissed") === "1";
}
export function markWaitlistDismissed(): void {
  ssSet("sos:waitlist-dismissed", "1");
}

/** Cross-page handoff (e.g. collection → scan re-run). Session-scoped. */
export function stash<T>(key: string, value: T): void {
  try {
    ssSet(`sos:stash:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
export function unstash<T>(key: string): T | undefined {
  const raw = ssGet(`sos:stash:${key}`);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function newId(prefix = "c"): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    /* fall through */
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
