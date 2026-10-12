import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "slab" | "sleeve" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon element rendered before the label. */
  iconLeft?: ReactNode;
  /** Icon element rendered after the label. */
  iconRight?: ReactNode;
  fullWidth?: boolean;
  /** Shows a spinner and disables the button. Ignored for links. */
  loading?: boolean;
  className?: string;
  children?: ReactNode;
};

export type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };
export type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | "href"> & {
    /** Renders a next/link instead of a <button>. External URLs get a plain <a>. */
    href: string;
    prefetch?: boolean;
  };
export type ButtonProps = ButtonAsButton | ButtonAsLink;

const base =
  "group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold " +
  "rounded-[10px] transition-[transform,background-color,box-shadow,color] duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-on-ink shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_2px_0_0_rgb(0_0_0/0.25)] hover:bg-ink/90",
  slab:
    "bg-slab text-[#241a02] shadow-[0_1px_0_rgb(255_255_255/0.45)_inset,0_2px_0_0_var(--slab-deep)] hover:brightness-105",
  sleeve:
    "bg-sleeve-soft text-sleeve-ink ring-1 ring-inset ring-sleeve/40 hover:bg-sleeve/20",
  ghost: "bg-transparent text-ink hover:bg-ink/[0.06]",
  outline: "bg-card text-ink ring-1 ring-inset ring-line-strong hover:ring-ink/50",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[0.95rem]",
  lg: "h-13 px-6 text-base",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: Pick<CommonProps, "variant" | "size" | "fullWidth" | "className"> = {}): string {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

/**
 * Button. Pass `href` to render a link (next/link for internal paths).
 * Variants: primary (ink), slab (gold, for "grade it" actions), sleeve, ghost, outline.
 */
export function Button(props: ButtonProps) {
  const { variant, size, iconLeft, iconRight, fullWidth, loading, className, children, ...rest } = props;
  const cls = buttonClasses({ variant, size, fullWidth, className });
  const inner = (
    <>
      {loading ? <Spinner size={16} label="" /> : iconLeft}
      {children}
      {iconRight}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, prefetch, ...anchorRest } = rest as Omit<ButtonAsLink, keyof CommonProps>;
    const external = /^(https?:|mailto:|tel:)/.test(href);
    if (external) {
      return (
        <a href={href} className={cls} {...anchorRest}>
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} prefetch={prefetch} className={cls} {...anchorRest}>
        {inner}
      </Link>
    );
  }

  const { type = "button", disabled, ...buttonRest } = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cls} {...buttonRest}>
      {inner}
    </button>
  );
}
