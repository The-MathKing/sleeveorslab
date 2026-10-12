// Auto-detection of card outer edge and inner border from an RGBA buffer.
// Pure TS, no DOM. Strategy:
//  1. Downscale to ~600px long side, grayscale, gradient magnitude.
//  2. Project |dI/dx| onto columns and |dI/dy| onto rows; the outermost strong
//     peaks near the image extents are the card's outer edges (coarse).
//  3. Refine at full resolution in several bands along each edge: find the outer
//     edge near the coarse estimate, then search inward for the first strong edge
//     within a plausible border width (1.5%–15% of the card dimension).
//  4. Per-band border widths (inner − outer) are tilt-tolerant; take medians.
//  5. Confidence from edge contrast and band-to-band consistency.
import type { CenteringMeasurement } from "@/lib/types";
import { ratioOf } from "./format";
import { rectQuad } from "./quads";

export interface ImageLike { width: number; height: number; data: Uint8ClampedArray }

export const DETECT_LONG_SIDE_PX = 600;
export const MIN_BORDER_FRACTION = 0.015;
export const MAX_BORDER_FRACTION = 0.15;
const BANDS = 8;
const MAX_ROWS_PER_BAND = 64;

type Gray = (x: number, y: number) => number;
/** Colour difference between two pixels. Yellow borders and silver frames often share
 *  luminance, so edges are measured in RGB, not grayscale. */
type Diff = (x0: number, y0: number, x1: number, y1: number) => number;

function colorDiffAccessor(img: ImageLike): Diff {
  const { width, height, data } = img;
  const idx = (x: number, y: number) => {
    const xi = x < 0 ? 0 : x >= width ? width - 1 : x;
    const yi = y < 0 ? 0 : y >= height ? height - 1 : y;
    return (yi * width + xi) * 4;
  };
  return (x0, y0, x1, y1) => {
    const a = idx(x0, y0), b = idx(x1, y1);
    const dr = data[a] - data[b], dg = data[a + 1] - data[b + 1], db = data[a + 2] - data[b + 2];
    return Math.sqrt((dr * dr + dg * dg + db * db) / 3);
  };
}

function grayAccessor(img: ImageLike): Gray {
  const { width, height, data } = img;
  return (x, y) => {
    const xi = x < 0 ? 0 : x >= width ? width - 1 : x;
    const yi = y < 0 ? 0 : y >= height ? height - 1 : y;
    const i = (yi * width + xi) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
}

function downscaleGray(img: ImageLike): { w: number; h: number; px: Float32Array; scale: number } {
  const long = Math.max(img.width, img.height);
  const f = Math.max(1, Math.ceil(long / DETECT_LONG_SIDE_PX));
  const w = Math.floor(img.width / f), h = Math.floor(img.height / f);
  const px = new Float32Array(w * h);
  const g = grayAccessor(img);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += g(x * f + dx, y * f + dy);
    px[y * w + x] = s / (f * f);
  }
  return { w, h, px, scale: f };
}

function median(a: number[]): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function smooth(p: Float64Array): Float64Array {
  const o = new Float64Array(p.length);
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[Math.min(p.length - 1, i + 1)];
    o[i] = (a + 2 * b + c) / 4;
  }
  return o;
}

/** Outermost strong peak scanning from `from` towards `to` (exclusive). */
function outermostPeak(p: Float64Array, from: number, to: number): number {
  const step = to > from ? 1 : -1;
  let max = 0;
  for (let i = from; i !== to; i += step) max = Math.max(max, p[i]);
  const base = median(Array.from(p));
  const thr = base + 0.3 * (max - base);
  if (!(max > base * 1.5 + 1)) return -1;
  for (let i = from; i !== to; i += step) {
    if (p[i] >= thr) {
      // climb to the local maximum of this run
      let j = i;
      while (j + step !== to && p[j + step] >= p[j]) j += step;
      return j;
    }
  }
  return -1;
}

/** Sub-pixel peak location via parabola through neighbours. */
function subpixel(p: ArrayLike<number>, i: number): number {
  if (i <= 0 || i >= p.length - 1) return i;
  const a = p[i - 1], b = p[i], c = p[i + 1];
  const d = a - 2 * b + c;
  if (d === 0) return i;
  const off = (a - c) / (2 * d);
  return i + Math.max(-1, Math.min(1, off));
}

interface EdgeHit { pos: number; strength: number }

/**
 * Gradient profile along a scan line set. `vertical` = vertical edge (scan x).
 * Positions are in edge coordinates (boundary between pixels i-1 and i = i).
 */
function profile(d: Diff, vertical: boolean, lo: number, hi: number, across: number[]): Float64Array {
  const n = hi - lo + 1;
  const out = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const t = lo + k;
    let s = 0;
    for (const a of across) s += vertical ? d(t + 1, a, t - 1, a) : d(a, t + 1, a, t - 1);
    out[k] = s / across.length;
  }
  return out;
}

function peakIn(p: Float64Array, lo: number, from: number, to: number, mode: "max" | "first"): EdgeHit | undefined {
  const a = Math.max(0, Math.min(from, to) - lo), b = Math.min(p.length - 1, Math.max(from, to) - lo);
  if (b <= a) return undefined;
  let mi = -1, mv = 0;
  for (let i = a; i <= b; i++) if (p[i] > mv) { mv = p[i]; mi = i; }
  if (mi < 0) return undefined;
  let idx = mi;
  if (mode === "first") {
    const thr = 0.5 * mv;
    const forward = to >= from;
    const start = forward ? a : b, end = forward ? b : a, st = forward ? 1 : -1;
    for (let i = start; forward ? i <= end : i >= end; i += st) {
      if (p[i] >= thr) {
        let j = i;
        while ((forward ? j + st <= end : j + st >= end) && p[j + st] >= p[j]) j += st;
        idx = j;
        break;
      }
    }
  }
  // Boundary between pixel t-1 and t yields equal gradient at t-1 and t; the
  // parabola peak lands at t-0.5 in pixel-centre coords, i.e. boundary t-0.5+0.5.
  return { pos: lo + subpixel(p, idx) + 0.5, strength: p[idx] };
}

function sampleLine(a: number, b: number, max: number): number[] {
  const lo = Math.ceil(Math.min(a, b)), hi = Math.floor(Math.max(a, b));
  const n = hi - lo + 1;
  if (n <= 0) return [];
  const step = Math.max(1, Math.floor(n / max));
  const out: number[] = [];
  for (let v = lo; v <= hi; v += step) out.push(v);
  return out;
}

export function defaultMeasurement(img: ImageLike): CenteringMeasurement {
  const w = Math.max(1, img.width || 1), h = Math.max(1, img.height || 1);
  const ox = w * 0.05, oy = h * 0.05;
  const b = w * 0.045;
  return {
    leftRight: 0.5, topBottom: 0.5,
    borders: { left: b, right: b, top: b, bottom: b },
    outer: rectQuad(ox, oy, w - ox, h - oy),
    inner: rectQuad(ox + b, oy + b, w - ox - b, h - oy - b),
    confidence: 0, method: "auto",
  };
}

type Side = "left" | "right" | "top" | "bottom";

export function detectCentering(img: ImageLike): CenteringMeasurement {
  try {
    if (!img || img.width < 40 || img.height < 40 || img.data.length < img.width * img.height * 4) return defaultMeasurement(img);
    return detectInner(img) ?? defaultMeasurement(img);
  } catch {
    return defaultMeasurement(img);
  }
}

function detectInner(img: ImageLike): CenteringMeasurement | undefined {
  const { w, h, px, scale } = downscaleGray(img);
  // --- coarse outer edges on the downscaled image ---
  const colP = new Float64Array(w), rowP = new Float64Array(h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    colP[x] += Math.abs(px[y * w + x + 1] - px[y * w + x - 1]);
    rowP[y] += Math.abs(px[(y + 1) * w + x] - px[(y - 1) * w + x]);
  }
  const cs = smooth(colP), rs = smooth(rowP);
  const cL = outermostPeak(cs, 1, Math.floor(w * 0.45));
  const cR = outermostPeak(cs, w - 2, Math.ceil(w * 0.55));
  const cT = outermostPeak(rs, 1, Math.floor(h * 0.45));
  const cB = outermostPeak(rs, h - 2, Math.ceil(h * 0.55));
  if (cL < 0 || cR < 0 || cT < 0 || cB < 0) return undefined;

  const g = colorDiffAccessor(img);
  const W = img.width, H = img.height;
  // coarse in full-res edge coordinates
  const coarse: Record<Side, number> = {
    left: (cL + 0.5) * scale, right: (cR + 0.5) * scale, top: (cT + 0.5) * scale, bottom: (cB + 0.5) * scale,
  };
  const cardW = coarse.right - coarse.left, cardH = coarse.bottom - coarse.top;
  if (cardW < 20 || cardH < 20) return undefined;
  const win = Math.max(4, Math.round(0.02 * Math.max(cardW, cardH)), scale * 2);

  const sides: Side[] = ["left", "right", "top", "bottom"];
  const res: Record<Side, { outer: number[]; border: number[]; so: number[]; si: number[] }> = {
    left: { outer: [], border: [], so: [], si: [] }, right: { outer: [], border: [], so: [], si: [] },
    top: { outer: [], border: [], so: [], si: [] }, bottom: { outer: [], border: [], so: [], si: [] },
  };
  let noiseAcc = 0, noiseN = 0;

  for (const side of sides) {
    const vertical = side === "left" || side === "right";
    const dir = side === "left" || side === "top" ? 1 : -1; // inward direction
    const dim = vertical ? cardW : cardH;
    const minB = MIN_BORDER_FRACTION * dim, maxB = MAX_BORDER_FRACTION * dim;
    const along0 = vertical ? coarse.top + 0.2 * cardH : coarse.left + 0.2 * cardW;
    const along1 = vertical ? coarse.bottom - 0.2 * cardH : coarse.right - 0.2 * cardW;
    const limit = vertical ? W - 2 : H - 2;
    const c = coarse[side];
    const lo = Math.max(1, Math.floor(Math.min(c - win, c + dir * (maxB + win)) ));
    const hi = Math.min(limit, Math.ceil(Math.max(c + win, c + dir * (maxB + win))));
    for (let b = 0; b < BANDS; b++) {
      const a0 = along0 + ((along1 - along0) * b) / BANDS;
      const a1 = along0 + ((along1 - along0) * (b + 1)) / BANDS;
      const across = sampleLine(a0, a1, MAX_ROWS_PER_BAND);
      if (!across.length) continue;
      const p = profile(g, vertical, lo, hi, across);
      // Edge coords: hit.pos is the boundary position; profile index k ↔ coordinate lo+k.
      const outer = peakIn(p, lo, Math.round(c - dir * win), Math.round(c + dir * win), "first");
      if (!outer) continue;
      const inner = peakIn(p, lo, Math.round(outer.pos + dir * minB), Math.round(outer.pos + dir * maxB), "first");
      if (!inner) continue;
      const border = (inner.pos - outer.pos) * dir;
      if (border <= 0) continue;
      res[side].outer.push(outer.pos);
      res[side].border.push(border);
      res[side].so.push(outer.strength);
      res[side].si.push(inner.strength);
      // noise level: median of profile
      noiseAcc += median(Array.from(p));
      noiseN++;
    }
  }
  if (sides.some((s) => res[s].border.length < BANDS / 2)) return undefined;

  const noise = noiseN ? noiseAcc / noiseN : 0;
  const outerPos: Record<Side, number> = { left: 0, right: 0, top: 0, bottom: 0 };
  const border: Record<Side, number> = { left: 0, right: 0, top: 0, bottom: 0 };
  const confs: number[] = [];
  for (const s of sides) {
    outerPos[s] = median(res[s].outer);
    border[s] = median(res[s].border);
    const mad = median(res[s].border.map((v) => Math.abs(v - border[s])));
    const strength = Math.min(median(res[s].so), median(res[s].si));
    const contrast = strength > 0 ? Math.max(0, (strength - noise) / strength) : 0;
    const consistency = 1 / (1 + mad / Math.max(1, 0.05 * border[s]));
    const coverage = res[s].border.length / BANDS;
    confs.push(contrast * consistency * coverage);
  }
  const fullW = outerPos.right - outerPos.left, fullH = outerPos.bottom - outerPos.top;
  if (fullW <= 0 || fullH <= 0) return undefined;
  // Penalise implausible aspect ratios (cards are ~63x88mm, either orientation).
  const aspect = Math.min(fullW, fullH) / Math.max(fullW, fullH);
  const aspectOk = aspect > 0.6 && aspect < 0.85 ? 1 : 0.5;
  const confidence = Math.max(0, Math.min(1, (confs.reduce((a, b) => a + b, 0) / confs.length) * aspectOk));

  const outer = rectQuad(outerPos.left, outerPos.top, outerPos.right, outerPos.bottom);
  const inner = rectQuad(
    outerPos.left + border.left, outerPos.top + border.top,
    outerPos.right - border.right, outerPos.bottom - border.bottom,
  );
  return {
    leftRight: ratioOf(border.left, border.right),
    topBottom: ratioOf(border.top, border.bottom),
    borders: { ...border },
    outer, inner,
    confidence: Math.round(confidence * 1000) / 1000,
    method: "auto",
  };
}
