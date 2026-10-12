"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

export type ToastTone = "neutral" | "good" | "bad" | "sleeve" | "slab";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** ms before auto-dismiss. 0 = sticky. Default 4500. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const tones: Record<ToastTone, string> = {
  neutral: "border-line",
  good: "border-good/60",
  bad: "border-bad/60",
  sleeve: "border-sleeve/60",
  slab: "border-slab",
};
const bars: Record<ToastTone, string> = {
  neutral: "bg-ink-3",
  good: "bg-good",
  bad: "bg-bad",
  sleeve: "bg-sleeve",
  slab: "bg-slab",
};

/** Wrap the app once (done in the root layout). Then call useToast().toast({...}). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-3), { ...opts, id }]);
      const duration = opts.duration ?? 4500;
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "bad" ? "alert" : "status"}
            className={cn(
              "toast-in pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl border bg-card py-3 pl-4 pr-2 shadow-lift",
              tones[t.tone ?? "neutral"],
            )}
          >
            <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", bars[t.tone ?? "neutral"])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-ink-2">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-1 text-ink-3 hover:bg-ink/5 hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Returns { toast, dismiss }. Safe outside the provider (no-ops with a console warning in dev). */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  return {
    toast: () => {
      if (process.env.NODE_ENV !== "production") console.warn("useToast called outside <ToastProvider>");
      return -1;
    },
    dismiss: () => {},
  };
}
