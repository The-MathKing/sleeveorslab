import type { CenteringMeasurement, Quad } from "@/lib/types";
import { ratioOf } from "./format";

export function rectQuad(left: number, top: number, right: number, bottom: number): Quad {
  return { tl: { x: left, y: top }, tr: { x: right, y: top }, br: { x: right, y: bottom }, bl: { x: left, y: bottom } };
}

/** Borders from user-adjusted quads: each side averages its two corner distances. */
export function measureFromQuads(outer: Quad, inner: Quad): CenteringMeasurement {
  const pos = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);
  const left = pos(((inner.tl.x - outer.tl.x) + (inner.bl.x - outer.bl.x)) / 2);
  const right = pos(((outer.tr.x - inner.tr.x) + (outer.br.x - inner.br.x)) / 2);
  const top = pos(((inner.tl.y - outer.tl.y) + (inner.tr.y - outer.tr.y)) / 2);
  const bottom = pos(((outer.bl.y - inner.bl.y) + (outer.br.y - inner.br.y)) / 2);
  return {
    leftRight: ratioOf(left, right),
    topBottom: ratioOf(top, bottom),
    borders: { left, right, top, bottom },
    outer, inner, confidence: 1, method: "manual",
  };
}
