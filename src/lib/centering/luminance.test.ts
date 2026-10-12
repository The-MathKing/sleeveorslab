import { expect, it } from "vitest";
import { detectCentering } from "./detect";

function render(opts: { shadow: boolean; radius: number; bars: boolean }) {
  const W = 900, H = 1200;
  const g = new Float32Array(W * H * 3);
  const set = (x: number, y: number, r: number, gg: number, b: number, a = 1) => {
    const i = (y * W + x) * 3; g[i] = g[i] * (1 - a) + r * a; g[i + 1] = g[i + 1] * (1 - a) + gg * a; g[i + 2] = g[i + 2] * (1 - a) + b * a;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, 30, 34, 40);
  const cw = 630, ch = 880, cx = 135, cy = 160, R = opts.radius;
  const inCard = (x: number, y: number, ox = 0, oy = 0) => {
    const px = x - cx - ox, py = y - cy - oy;
    if (px < 0 || py < 0 || px >= cw || py >= ch) return false;
    const qx = Math.min(px, cw - 1 - px), qy = Math.min(py, ch - 1 - py);
    if (qx < R && qy < R) return (R - qx) ** 2 + (R - qy) ** 2 <= R * R;
    return true;
  };
  if (opts.shadow) {
    // crude blurred shadow: alpha falls off with distance to the offset card
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let d = 99;
      for (let k = 0; k <= 28 && d === 99; k += 2) {
        if (inCard(x - k, y, 0, 10) || inCard(x + k, y, 0, 10) || inCard(x, y - k, 0, 10) || inCard(x, y + k, 0, 10)) d = k;
      }
      if (d < 99) set(x, y, 0, 0, 0, 0.55 * (1 - d / 28));
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inCard(x, y)) {
    const t = ((x - cx) + (y - cy)) / (cw + ch);
    set(x, y, 242 - t * 25, 210 - t * 33, 87 - t * 41);
  }
  const left = 36, right = 28, top = 37, bottom = 33;
  const ix = cx + left, iy = cy + top, iw = cw - left - right, ih = ch - top - bottom;
  for (let y = iy; y < iy + ih; y++) for (let x = ix; x < ix + iw; x++) set(x, y, 207, 211, 216);
  if (opts.bars) for (let y = iy + 14; y < iy + 58; y++) for (let x = ix + 14; x < ix + iw - 14; x++) set(x, y, 244, 241, 232);
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = g[i * 3]; data[i * 4 + 1] = g[i * 3 + 1]; data[i * 4 + 2] = g[i * 3 + 2]; data[i * 4 + 3] = 255; }
  return { width: W, height: H, data };
}

// Regression: yellow border and silver face share luminance; a grayscale detector
// skipped the real edge and locked onto the bright name bar.
it("detects equal-luminance yellow/silver borders with rounded corners and a drop shadow", () => {
  for (const o of [{ shadow: false, radius: 0, bars: false }, { shadow: false, radius: 22, bars: true }, { shadow: true, radius: 22, bars: true }]) {
    const m = detectCentering(render(o));
    expect(m.borders.left).toBeCloseTo(36, 0);
    expect(m.borders.right).toBeCloseTo(28, 0);
    expect(m.borders.top).toBeCloseTo(37, 0);
    expect(m.borders.bottom).toBeCloseTo(33, 0);
  }
});
