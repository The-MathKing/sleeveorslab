/** Format a centering ratio (larger share) as "55/45". Values below 0.5 are mirrored. */
export function formatRatio(r: number): string {
  if (!Number.isFinite(r)) return "50/50";
  const v = Math.min(1, Math.max(0, r));
  const big = Math.round(Math.max(v, 1 - v) * 100);
  return `${big}/${100 - big}`;
}

/** max(a,b)/(a+b); 0.5 when both are zero. */
export function ratioOf(a: number, b: number): number {
  const x = Math.max(0, a), y = Math.max(0, b);
  const s = x + y;
  return s > 0 ? Math.max(x, y) / s : 0.5;
}
