"use client";

import { cloneElement, isValidElement, useId, type LabelHTMLAttributes, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold text-ink", className)} {...rest} />;
}

export interface FieldProps {
  label: ReactNode;
  /** Helper text under the control. */
  hint?: ReactNode;
  /** Error message; also flips the control to aria-invalid. */
  error?: ReactNode;
  /** Optional explicit id; otherwise one is generated and injected into the child control. */
  id?: string;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
  className?: string;
  /** A single form control (Input, Select, textarea...). It receives id/aria-describedby/aria-invalid. */
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, id, hideLabel, className, children }: FieldProps) {
  const auto = useId();
  const controlId = id ?? `f-${auto}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errId = error ? `${controlId}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id: controlId, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
    : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={controlId} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs font-semibold text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
