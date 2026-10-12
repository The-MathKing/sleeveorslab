// Optional: read the collector number from the bottom strip of the front photo.
// tesseract.js is lazy-loaded only when the user taps the button. Any failure returns null.
import type { CenteringMeasurement } from "@/lib/types";

export interface OcrHit {
  number: string; // e.g. "199"
  total?: string; // e.g. "165"
  raw: string;
}

export async function readCardNumber(src: HTMLCanvasElement, m?: CenteringMeasurement): Promise<OcrHit | null> {
  try {
    const strip = cropBottomStrip(src, m);
    if (!strip) return null;
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const { data } = await worker.recognize(strip);
      return parseNumber(data.text ?? "");
    } finally {
      void worker.terminate();
    }
  } catch {
    return null;
  }
}

export function parseNumber(text: string): OcrHit | null {
  const t = text.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
  const frac = t.match(/(\d{1,3})\s*\/\s*(\d{2,3})/);
  if (frac) return { number: String(Number(frac[1])), total: String(Number(frac[2])), raw: frac[0] };
  const promo = t.match(/\b(SWSH|SM|XY|SVP|BW|TG|GG)\s?(\d{1,3})\b/i);
  if (promo) return { number: `${promo[1].toUpperCase()}${promo[2]}`, raw: promo[0] };
  return null;
}

function cropBottomStrip(src: HTMLCanvasElement, m?: CenteringMeasurement): HTMLCanvasElement | null {
  let l = 0;
  let r = src.width;
  let t = Math.round(src.height * 0.85);
  let b = src.height;
  if (m) {
    const o = m.outer;
    l = Math.min(o.tl.x, o.bl.x);
    r = Math.max(o.tr.x, o.br.x);
    const bottom = Math.max(o.bl.y, o.br.y);
    const top = Math.min(o.tl.y, o.tr.y);
    t = top + (bottom - top) * 0.88;
    b = bottom;
  }
  const w = Math.max(1, r - l);
  const h = Math.max(1, b - t);
  const scale = Math.min(3, 1800 / w);
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.filter = "grayscale(1) contrast(1.6)";
  ctx.drawImage(src, l, t, w, h, 0, 0, c.width, c.height);
  return c;
}
