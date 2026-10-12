import { clsx, type ClassValue } from "clsx";

/** Join class names. Thin alias over clsx so call sites read the same everywhere. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
