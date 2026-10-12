import { describe, expect, it } from "vitest";
import { detectCentering, formatRatio, measureFromQuads, rectQuad, type ImageLike } from "./index";

/** Deterministic PRNG so noisy tests are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

interface Synth {
  W: number; H: number;
  card: { x: number; y: number; w: number; h: number };
  borders: { left: number; right: number; top: number; bottom: number };
  noise?: number; seed?: number; tiltDeg?: number;
}

function makeCard(o: Synth): ImageLike {
  const { W, H, card, borders } = o;
  const data = new Uint8ClampedArray(W * H * 4);
  const rand = rng(o.seed ?? 1);
  const t = ((o.tiltDeg ?? 0) * Math.PI) / 180;
  const cx = card.x + card.w / 2, cy = card.y + card.h / 2;
  const cos = Math.cos(t), sin = Math.sin(t);
  // Some "artwork" texture: blocks well inside the art window.
  const ax0 = card.x + borders.left, ay0 = card.y + borders.top;
  const ax1 = card.x + card.w - borders.right, ay1 = card.y + card.h - borders.bottom;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // rotate sample point back into card frame
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const u = cx + dx * cos + dy * sin, v = cy - dx * sin + dy * cos;
    let r = 40, g = 40, b = 45; // background
    if (u >= card.x && u < card.x + card.w && v >= card.y && v < card.y + card.h) {
      if (u >= ax0 && u < ax1 && v >= ay0 && v < ay1) {
        r = 60; g = 90; b = 160; // art frame
        const inset = 30;
        if (u > ax0 + inset && u < ax1 - inset && v > ay0 + inset && v < ay1 - inset) {
          const blk = (Math.floor(u / 23) + Math.floor(v / 31)) % 3;
          if (blk === 0) { r = 200; g = 120; b = 60; } else if (blk === 1) { r = 30; g = 160; b = 90; }
        }
      } else {
        r = 230; g = 200; b = 40; // yellow border
      }
    }
    const n = o.noise ? (rand() - 0.5) * 2 * o.noise : 0;
    const i = (y * W + x) * 4;
    data[i] = r + n; data[i + 1] = g + n; data[i + 2] = b + n; data[i + 3] = 255;
  }
  return { width: W, height: H, data };
}

const base = { W: 500, H: 700, card: { x: 50, y: 71, w: 400, h: 558 } };

describe("formatRatio", () => {
  it("formats ratios", () => {
    expect(formatRatio(0.55)).toBe("55/45");
    expect(formatRatio(0.5)).toBe("50/50");
    expect(formatRatio(0.618)).toBe("62/38");
    expect(formatRatio(0.45)).toBe("55/45");
    expect(formatRatio(1)).toBe("100/0");
    expect(formatRatio(NaN)).toBe("50/50");
  });
});

describe("measureFromQuads", () => {
  it("computes borders and ratios from quads", () => {
    const m = measureFromQuads(rectQuad(0, 0, 100, 140), rectQuad(11, 6, 91, 132));
    expect(m.borders).toEqual({ left: 11, right: 9, top: 6, bottom: 8 });
    expect(m.leftRight).toBeCloseTo(0.55, 9);
    expect(m.topBottom).toBeCloseTo(8 / 14, 9);
    expect(m.method).toBe("manual");
    expect(m.confidence).toBe(1);
  });
  it("averages the two corner distances per side", () => {
    const outer = rectQuad(0, 0, 100, 140);
    const inner = { tl: { x: 10, y: 5 }, tr: { x: 90, y: 7 }, br: { x: 92, y: 131 }, bl: { x: 12, y: 133 } };
    const m = measureFromQuads(outer, inner);
    expect(m.borders.left).toBe(11);
    expect(m.borders.right).toBe(9);
    expect(m.borders.top).toBe(6);
    expect(m.borders.bottom).toBe(8);
  });
  it("never returns negative borders", () => {
    const m = measureFromQuads(rectQuad(10, 10, 100, 100), rectQuad(0, 0, 110, 110));
    expect(m.leftRight).toBe(0.5);
    expect(Object.values(m.borders).every((v) => v === 0)).toBe(true);
  });
});

describe("detectCentering", () => {
  const cases: Array<[string, Synth["borders"], number, number]> = [
    ["50/50", { left: 20, right: 20, top: 24, bottom: 24 }, 0.5, 0.5],
    ["55/45 LR", { left: 22, right: 18, top: 24, bottom: 24 }, 0.55, 0.5],
    ["62/38 LR, 55/45 TB", { left: 19, right: 31, top: 22, bottom: 18 }, 0.62, 0.55],
    ["60/40 TB", { left: 20, right: 20, top: 30, bottom: 20 }, 0.5, 0.6],
  ];
  for (const [name, borders, lr, tb] of cases) {
    it(`detects ${name}`, () => {
      const m = detectCentering(makeCard({ ...base, borders }));
      expect(m.method).toBe("auto");
      expect(Math.abs(m.leftRight - lr)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(m.topBottom - tb)).toBeLessThanOrEqual(0.02);
      expect(m.confidence).toBeGreaterThan(0.5);
      expect(Math.abs(m.borders.left - borders.left)).toBeLessThan(1.5);
      expect(Math.abs(m.outer.tl.x - base.card.x)).toBeLessThan(1.5);
      expect(Math.abs(m.outer.br.y - (base.card.y + base.card.h))).toBeLessThan(1.5);
    });
  }

  it("detects 62/38 with heavy pixel noise", () => {
    const borders = { left: 31, right: 19, top: 24, bottom: 24 };
    const m = detectCentering(makeCard({ ...base, borders, noise: 30, seed: 7 }));
    expect(Math.abs(m.leftRight - 0.62)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(m.topBottom - 0.5)).toBeLessThanOrEqual(0.02);
    expect(m.confidence).toBeGreaterThan(0.2);
  });

  it("works on a large image (downscale path) with borders in original px", () => {
    const big = { W: 1000, H: 1400, card: { x: 100, y: 142, w: 800, h: 1116 } };
    const borders = { left: 44, right: 36, top: 48, bottom: 48 };
    const m = detectCentering(makeCard({ ...big, borders }));
    expect(Math.abs(m.leftRight - 0.55)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(m.borders.left - 44)).toBeLessThan(2);
    expect(Math.abs(m.outer.tr.x - 900)).toBeLessThan(2);
  });

  it("tolerates a small tilt", () => {
    const borders = { left: 22, right: 18, top: 24, bottom: 24 };
    const m = detectCentering(makeCard({ ...base, borders, tiltDeg: 0.6, noise: 10 }));
    expect(Math.abs(m.leftRight - 0.55)).toBeLessThanOrEqual(0.03);
    expect(Math.abs(m.topBottom - 0.5)).toBeLessThanOrEqual(0.03);
  });

  it("returns a centered default with confidence 0 on a blank image, never throws", () => {
    const W = 300, H = 400;
    const data = new Uint8ClampedArray(W * H * 4).fill(128);
    const m = detectCentering({ width: W, height: H, data });
    expect(m.confidence).toBe(0);
    expect(m.leftRight).toBe(0.5);
    expect(m.topBottom).toBe(0.5);
    expect(() => detectCentering({ width: 0, height: 0, data: new Uint8ClampedArray(0) })).not.toThrow();
    expect(() => detectCentering({ width: 100, height: 100, data: new Uint8ClampedArray(10) })).not.toThrow();
  });
});
