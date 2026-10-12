"use client";

import { useId, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "./cn";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  /** Make the trigger wrapper focusable. Leave false if children is already a button/link. */
  focusable?: boolean;
  className?: string;
}

/** CSS-only tooltip: shows on hover and keyboard focus. Content is linked via aria-describedby. */
export function Tooltip({ content, children, side = "top", focusable = false, className }: TooltipProps) {
  const id = useId();
  return (
    <span
      className={cn("group/tip relative inline-flex", className)}
      aria-describedby={id}
      tabIndex={focusable ? 0 : undefined}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute left-1/2 z-50 w-max max-w-[min(18rem,80vw)] -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5",
          "text-left text-xs font-normal normal-case leading-snug tracking-normal text-on-ink opacity-0 shadow-lift transition-opacity duration-150",
          "group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100",
          side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
        )}
      >
        {content}
      </span>
    </span>
  );
}

/** A small (i) button that reveals an explanation. Good for assumptions next to numbers. */
export function InfoTip({ content, label = "More info", className }: { content: ReactNode; label?: string; className?: string }) {
  return (
    <Tooltip content={content} className={className}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-5 items-center justify-center rounded-full text-ink-3 hover:text-ink"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
