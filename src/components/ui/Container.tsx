import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
  as?: "div" | "section" | "main" | "header" | "footer" | "article";
}

const sizes = { sm: "max-w-2xl", md: "max-w-3xl", lg: "max-w-5xl", xl: "max-w-6xl" } as const;

/** Centered column with 16px mobile gutters (24px from sm up). */
export function Container({ size = "xl", as: Tag = "div", className, ...rest }: ContainerProps) {
  return <Tag className={cn("mx-auto w-full px-4 sm:px-6", sizes[size], className)} {...rest} />;
}
