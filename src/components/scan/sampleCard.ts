// Synthetic "photo" of a trading card for the try-it-without-a-photo demo.
// Generic shapes only: a yellow border, an abstract artwork window, text bars. No real card art.

export const SAMPLE_OFFSET = { lr: 0.57, tb: 0.53 }; // intended larger-side share, for reference

export function makeSampleCard(): HTMLCanvasElement {
  const W = 900;
  const H = 1200;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  // Table surface: dark felt with a soft vignette so the card edge is clear.
  const bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, H * 0.75);
  bg.addColorStop(0, "#2b3038");
  bg.addColorStop(1, "#14171c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Card (63x88 ratio).
  const cw = 630;
  const ch = Math.round((cw * 88) / 63); // 880
  const cx = Math.round((W - cw) / 2);
  const cy = Math.round((H - ch) / 2);

  // Drop shadow.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, cx, cy, cw, ch, 22);
  ctx.fillStyle = "#e9c440";
  ctx.fill();
  ctx.restore();

  // Border: yellow with a subtle gradient.
  const border = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
  border.addColorStop(0, "#f2d257");
  border.addColorStop(1, "#d9b12e");
  roundRect(ctx, cx, cy, cw, ch, 22);
  ctx.fillStyle = border;
  ctx.fill();

  // Inner frame, deliberately off-center: left border wider than right (≈57/43), top wider than bottom (≈53/47).
  const totalLR = 64; // left + right border px
  const totalTB = 70;
  const left = Math.round(totalLR * SAMPLE_OFFSET.lr);
  const right = totalLR - left;
  const top = Math.round(totalTB * SAMPLE_OFFSET.tb);
  const bottom = totalTB - top;
  const ix = cx + left;
  const iy = cy + top;
  const iw = cw - left - right;
  const ih = ch - top - bottom;

  // Card face (silver-ish frame).
  ctx.fillStyle = "#cfd3d8";
  ctx.fillRect(ix, iy, iw, ih);

  // Name bar.
  ctx.fillStyle = "#f4f1e8";
  ctx.fillRect(ix + 14, iy + 14, iw - 28, 44);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(ix + 26, iy + 28, 180, 16);
  ctx.fillRect(ix + iw - 110, iy + 28, 80, 16);

  // Artwork window: abstract gradient + shapes.
  const ax = ix + 26;
  const ay = iy + 70;
  const aw = iw - 52;
  const ah = Math.round(ih * 0.42);
  const art = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah);
  art.addColorStop(0, "#3a7bd5");
  art.addColorStop(0.5, "#7b5cc4");
  art.addColorStop(1, "#e0794c");
  ctx.fillStyle = art;
  ctx.fillRect(ax, ay, aw, ah);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(ax + ((i * 97) % aw), ay + ((i * 61) % ah), 18 + ((i * 13) % 40), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#b9a35a";
  ctx.lineWidth = 6;
  ctx.strokeRect(ax, ay, aw, ah);

  // Text lines for attacks.
  ctx.fillStyle = "#3b3f46";
  const ty = ay + ah + 36;
  for (let i = 0; i < 5; i++) {
    const w = i % 2 === 0 ? iw - 80 : iw - 180;
    ctx.fillRect(ix + 30, ty + i * 44, w, i % 2 === 0 ? 18 : 12);
  }
  // Collector number strip, bottom-left.
  ctx.font = "bold 20px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "#2a2a2a";
  ctx.fillText("042/165", ix + 22, iy + ih - 22);

  // Faint glare for realism.
  const glare = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch * 0.6);
  glare.addColorStop(0, "rgba(255,255,255,0)");
  glare.addColorStop(0.45, "rgba(255,255,255,0.10)");
  glare.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(cx, cy, cw, ch);

  return c;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
