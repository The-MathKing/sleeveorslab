"use client";
import clsx from "clsx";
import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { CardRef } from "@/lib/types";
import { searchCards } from "./format";
import { CardThumb, ErrorNote, Skeleton } from "./parts";

export function CardSearch({
  onPick,
  query,
  onQueryChange,
  autoFocus,
  layout = "grid",
  actionLabel = "Pick",
  pickedIds,
}: {
  onPick: (card: CardRef) => void;
  /** Controlled query (optional). */
  query?: string;
  onQueryChange?: (q: string) => void;
  autoFocus?: boolean;
  layout?: "grid" | "list";
  actionLabel?: string;
  pickedIds?: Set<string>;
}) {
  const id = useId();
  const [inner, setInner] = useState("");
  const q = query ?? inner;
  const setQ = (v: string) => (onQueryChange ? onQueryChange(v) : setInner(v));
  const [results, setResults] = useState<CardRef[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const cards = await searchCards(term, 18, ctrl.signal);
        setResults(cards);
        setError(null);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, nonce]);

  return (
    <div className="w-full">
      <label htmlFor={id} className="sr-only">
        Search cards by name, number, or set
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          type="search"
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="charizard 199 or 199/165"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-line bg-card pl-10 pr-11 text-base text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-ink"
        />
        {q ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
            className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="mt-3" aria-live="polite" aria-busy={loading}>
        {error ? (
          <ErrorNote onRetry={() => setNonce((n) => n + 1)}>Search is having a moment: {error}</ErrorNote>
        ) : loading && !results ? (
          <SearchSkeleton layout={layout} />
        ) : results && results.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-2">
            No matches for “{q.trim()}”. Try the name plus the number on the bottom of the card.
          </p>
        ) : results ? (
          <ul
            className={clsx(
              layout === "grid" ? "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" : "flex flex-col gap-1.5",
              loading && "opacity-60",
            )}
          >
            {results.map((c) => {
              const picked = pickedIds?.has(c.id);
              return (
                <li key={c.id}>
                  {layout === "grid" ? (
                    <button
                      type="button"
                      onClick={() => onPick(c)}
                      className="group flex w-full flex-col gap-1 rounded-lg p-1 text-left hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      <CardThumb src={c.imageSmall} alt={`${c.name} ${c.number}`} className="w-full" />
                      <span className="line-clamp-1 text-xs font-semibold">{c.name}</span>
                      <span className="line-clamp-1 font-mono text-[11px] text-ink-3">
                        {c.number} · {c.setName}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPick(c)}
                      className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-line bg-card px-2 py-1.5 text-left hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      <CardThumb src={c.imageSmall} alt="" className="w-9 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.name}</span>
                        <span className="block truncate font-mono text-xs text-ink-3">
                          {c.number} · {c.setName}
                        </span>
                      </span>
                      <span className={clsx("shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold", picked ? "bg-paper-2 text-ink-2" : "bg-ink text-paper")}>
                        {picked ? "Added ✓" : actionLabel}
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function SearchSkeleton({ layout }: { layout: "grid" | "list" }) {
  if (layout === "list")
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-1 p-1">
          <Skeleton className="aspect-[63/88] w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
