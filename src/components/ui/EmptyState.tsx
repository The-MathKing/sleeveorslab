import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Usually a <Button/>. */
  action?: ReactNode;
  className?: string;
}

/** For empty binders, empty logs, no search results. Dashed outline like an empty card slot in a binder page. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-line-strong bg-paper-2/50 px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-xl bg-card text-ink-2 shadow-card ring-1 ring-line [&_svg]:size-6">
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl font-bold uppercase tracking-wide text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
