import { clsx } from "clsx";
import { Logomark, LogomarkSimple } from "./Logomark";

type WordmarkProps = {
  className?: string;
  /** Visual size. "sm" for headers, "lg" for heroes. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Adds a trailing "?" for the series title treatment ("Sleeve or Slab?"). */
  question?: boolean;
};

const sizes = {
  sm: "text-[1.35rem]",
  md: "text-[1.85rem]",
  lg: "text-[2.75rem]",
  xl: "text-[clamp(3rem,10vw,5.5rem)]",
} as const;

/**
 * "Sleeve or Slab" set in the condensed display face, with "or" small, italic
 * and lifted, the way a card-shop price tag would write it.
 */
export function Wordmark({ className, size = "md", question = false }: WordmarkProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-baseline whitespace-nowrap font-display font-extrabold uppercase leading-none tracking-[0.01em] text-ink",
        sizes[size],
        className,
      )}
    >
      <span>Sleeve</span>
      <span
        className="mx-[0.14em] self-center font-sans text-[0.42em] font-semibold normal-case italic tracking-normal text-ink-2"
        style={{ transform: "translateY(-0.12em)" }}
      >
        or
      </span>
      <span>Slab</span>
      {question && <span className="text-slab-deep">?</span>}
    </span>
  );
}

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Hide the wordmark below the sm breakpoint (header on tiny screens). */
  compactOnMobile?: boolean;
};

/** Horizontal lockup: mark + wordmark. The accessible name is the brand name. */
export function Logo({ className, size = "sm", compactOnMobile = false }: LogoProps) {
  const markSize = size === "lg" ? 56 : size === "md" ? 42 : 32;
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      {markSize >= 24 ? <Logomark size={markSize} title="" /> : <LogomarkSimple size={markSize} title="" />}
      <span className={clsx(compactOnMobile && "max-[359px]:sr-only")}>
        <Wordmark size={size} />
      </span>
    </span>
  );
}
