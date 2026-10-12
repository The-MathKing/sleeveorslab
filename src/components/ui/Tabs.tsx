"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled value. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** "segmented" = pill switcher (good for PSA/CGC), "underline" = classic tabs. */
  variant?: "segmented" | "underline";
  /** Accessible name for the tab list. */
  label: string;
  className?: string;
  fullWidth?: boolean;
}

/** WAI-ARIA tabs with arrow/Home/End keyboard support. */
export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  variant = "segmented",
  label,
  className,
  fullWidth,
}: TabsProps) {
  const base = useId();
  const [inner, setInner] = useState(defaultValue ?? items[0]?.id);
  const current = value ?? inner;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (id: string) => {
    if (value === undefined) setInner(id);
    onValueChange?.(id);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0);
    const idx = items.findIndex((t) => t.id === current);
    const pos = enabled.indexOf(idx);
    let next: number | undefined;
    if (e.key === "ArrowRight") next = enabled[(pos + 1) % enabled.length];
    else if (e.key === "ArrowLeft") next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    select(items[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKey}
        className={cn(
          variant === "segmented"
            ? "inline-flex gap-1 rounded-xl bg-paper-2 p-1 ring-1 ring-inset ring-line"
            : "flex gap-5 border-b border-line",
          fullWidth && "flex w-full",
          "max-w-full overflow-x-auto",
        )}
      >
        {items.map((t, i) => {
          const selected = t.id === current;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={t.disabled}
              onClick={() => select(t.id)}
              className={cn(
                "whitespace-nowrap text-sm font-semibold transition-colors disabled:opacity-40",
                fullWidth && "flex-1",
                variant === "segmented"
                  ? cn(
                      "rounded-lg px-3.5 py-1.5",
                      selected ? "bg-card text-ink shadow-card ring-1 ring-line" : "text-ink-2 hover:text-ink",
                    )
                  : cn(
                      "-mb-px border-b-2 px-0.5 pb-2.5 pt-1",
                      selected ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink",
                    ),
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {items.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== current}
          tabIndex={0}
          className="mt-4 focus-visible:outline-offset-4"
        >
          {t.id === current && t.content}
        </div>
      ))}
    </div>
  );
}
