import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

export const controlBase =
  "w-full rounded-[10px] border border-line-strong bg-card text-ink placeholder:text-ink-3 " +
  "transition-[border-color,box-shadow] duration-150 " +
  "hover:border-ink-3 focus:border-ink focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-focus/25 " +
  "aria-[invalid=true]:border-bad aria-[invalid=true]:ring-bad/20 disabled:cursor-not-allowed disabled:opacity-60";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: "sm" | "md" | "lg";
  /** Static text/icon pinned inside the left edge, e.g. "$". */
  leading?: ReactNode;
  /** Use monospace (for money, cert numbers, card numbers). */
  mono?: boolean;
}

const inputSizes = { sm: "h-9 text-sm", md: "h-11 text-base", lg: "h-13 text-lg" } as const;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, inputSize = "md", leading, mono, ...rest },
  ref,
) {
  if (leading) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-ink-3">
          {leading}
        </span>
        <input
          ref={ref}
          className={cn(controlBase, inputSizes[inputSize], "pl-8 pr-3", mono && "font-mono", className)}
          {...rest}
        />
      </div>
    );
  }
  return (
    <input ref={ref} className={cn(controlBase, inputSizes[inputSize], "px-3", mono && "font-mono", className)} {...rest} />
  );
});

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  selectSize?: "sm" | "md" | "lg";
  /** Convenience: render these options. You can also pass <option> children. */
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
}

/** Native select (best on mobile), styled to match Input. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, selectSize = "md", options, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlBase, inputSizes[selectSize], "appearance-none pl-3 pr-9", className)}
        {...rest}
      >
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
      />
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(controlBase, "min-h-24 px-3 py-2 text-base", className)} {...rest} />;
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  description?: ReactNode;
}

/** Checkbox with its label. Clicking the text toggles it. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...rest },
  ref,
) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink-2", className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="mt-0.5 size-[1.1rem] shrink-0 cursor-pointer rounded accent-[var(--ink)]"
        {...rest}
      />
      <span>
        <span className="text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-3">{description}</span>}
      </span>
    </label>
  );
});
