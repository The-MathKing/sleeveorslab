// Browser image helpers: decode a user file into a downscaled canvas, make thumbnails.

export const MAX_SIDE = 1600;

export async function blobToCanvas(blob: Blob, maxSide = MAX_SIDE): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.decoding = "async";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file didn't decode as an image. Try a JPG or PNG."));
      el.src = url; // modern browsers apply EXIF orientation when drawing
    });
    return drawScaled(img, img.naturalWidth, img.naturalHeight, maxSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function drawScaled(src: CanvasImageSource, w: number, h: number, maxSide = MAX_SIDE): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, c.width, c.height);
  }
  return c;
}

export function thumbnail(src: HTMLCanvasElement, maxSide = 360, quality = 0.72): string {
  try {
    return drawScaled(src, src.width, src.height, maxSide).toDataURL("image/jpeg", quality);
  } catch {
    return "";
  }
}

export function canvasImageData(c: HTMLCanvasElement): ImageData | null {
  try {
    return c.getContext("2d", { willReadFrequently: true })?.getImageData(0, 0, c.width, c.height) ?? null;
  } catch {
    return null;
  }
}
