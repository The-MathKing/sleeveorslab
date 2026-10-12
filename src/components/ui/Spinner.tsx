import { cn } from "./cn";

export interface SpinnerProps {
  size?: number;
  /** Screen-reader text. Pass "" when a parent already announces the busy state. */
  label?: string;
  className?: string;
}

/** Card-corner spinner: a quarter-arc that rotates. Respects reduced motion (slows down). */
export function Spinner({ size = 20, label = "Loading", className }: SpinnerProps) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="animate-spin motion-reduce:[animation-duration:2.5s]"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
