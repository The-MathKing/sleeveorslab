"use client";
// Centering tool: photo → auto-detect → draggable outer/inner edges with a 4× loupe → live ratios.
// Used by /scan and embedded on the landing page as the live demo.
import clsx from "clsx";
import { Camera, ImagePlus, RotateCcw, Sparkles, Info } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { detectCentering, measureFromQuads, formatRatio } from "@/lib/centering";
import { centeringCaps } from "@/lib/grading";
import type { CenteringCap, CenteringMeasurement, CenteringResult, Point, Quad } from "@/lib/types";
import { blobToCanvas, canvasImageData, thumbnail } from "./image";
import { makeSampleCard } from "./sampleCard";
import { CameraCapture, cameraSupported } from "./CameraCapture";
import { Btn, Spinner } from "./parts";

export interface CenteringToolProps {
  side?: "front" | "back";
  compact?: boolean;
  onResult?: (m: CenteringMeasurement, thumbDataUrl: string) => void;
  /** Optional: receive the downscaled source canvas (e.g. for OCR of the card number). */
  onImage?: (canvas: HTMLCanvasElement) => void;
  className?: string;
}

type Ring = "outer" | "inner";
type Side = "left" | "right" | "top" | "bottom";
type EdgeId = `${Ring}-${Side}`;

const EDGES: EdgeId[] = [
  "outer-left",
  "outer-right",
  "outer-top",
  "outer-bottom",
  "inner-left",
  "inner-right",
  "inner-top",
  "inner-bottom",
];

const EDGE_LABEL: Record<EdgeId, string> = {
  "outer-left": "Card edge, left",
  "outer-right": "Card edge, right",
  "outer-top": "Card edge, top",
  "outer-bottom": "Card edge, bottom",
  "inner-left": "Border, left",
  "inner-right": "Border, right",
  "inner-top": "Border, top",
  "inner-bottom": "Border, bottom",
};

const LOUPE = 132; // css px
const ZOOM = 4;

interface Loaded {
  canvas: HTMLCanvasElement;
  url: string;
  thumb: string;
  w: number;
  h: number;
}

/* ---------------- geometry ---------------- */

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function edgeEnds(q: Quad, s: Side): [Point, Point] {
  switch (s) {
    case "left":
      return [q.tl, q.bl];
    case "right":
      return [q.tr, q.br];
    case "top":
      return [q.tl, q.tr];
    case "bottom":
      return [q.bl, q.br];
  }
}

function edgePos(q: Quad, s: Side): number {
  const [a, b] = edgeEnds(q, s);
  return s === "left" || s === "right" ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
}

function shiftEdge(q: Quad, s: Side, d: number, w: number, h: number): Quad {
  const clampX = (v: number) => Math.max(0, Math.min(w, v));
  const clampY = (v: number) => Math.max(0, Math.min(h, v));
  const n: Quad = { tl: { ...q.tl }, tr: { ...q.tr }, br: { ...q.br }, bl: { ...q.bl } };
  if (s === "left") {
    n.tl.x = clampX(n.tl.x + d);
    n.bl.x = clampX(n.bl.x + d);
  } else if (s === "right") {
    n.tr.x = clampX(n.tr.x + d);
    n.br.x = clampX(n.br.x + d);
  } else if (s === "top") {
    n.tl.y = clampY(n.tl.y + d);
    n.tr.y = clampY(n.tr.y + d);
  } else {
    n.bl.y = clampY(n.bl.y + d);
    n.br.y = clampY(n.br.y + d);
  }
  return n;
}

function rectQuad(l: number, t: number, r: number, b: number): Quad {
  return { tl: { x: l, y: t }, tr: { x: r, y: t }, br: { x: r, y: b }, bl: { x: l, y: b } };
}

function defaultQuads(w: number, h: number): { outer: Quad; inner: Quad } {
  const mx = w * 0.08;
  const my = h * 0.06;
  const bx = (w - 2 * mx) * 0.055;
  const by = (h - 2 * my) * 0.045;
  return {
    outer: rectQuad(mx, my, w - mx, h - my),
    inner: rectQuad(mx + bx, my + by, w - mx - bx, h - my - by),
  };
}

/** Local fallback if the engine isn't available (keeps the demo alive). */
function localMeasure(outer: Quad, inner: Quad): CenteringMeasurement {
  const left = Math.max(0, edgePos(inner, "left") - edgePos(outer, "left"));
  const right = Math.max(0, edgePos(outer, "right") - edgePos(inner, "right"));
  const top = Math.max(0, edgePos(inner, "top") - edgePos(outer, "top"));
  const bottom = Math.max(0, edgePos(outer, "bottom") - edgePos(inner, "bottom"));
  const share = (a: number, b: number) => (a + b > 0 ? Math.max(a, b) / (a + b) : 0.5);
  return {
    leftRight: share(left, right),
    topBottom: share(top, bottom),
    borders: { left, right, top, bottom },
    outer,
    inner,
    confidence: 1,
    method: "manual",
  };
}

function measure(outer: Quad, inner: Quad): CenteringMeasurement {
  try {
    return measureFromQuads(outer, inner);
  } catch {
    return localMeasure(outer, inner);
  }
}

function ratio(r: number): string {
  try {
    return formatRatio(r);
  } catch {
    const big = Math.round(r * 100);
    return `${big}/${100 - big}`;
  }
}

/** Caps for a single axis, by running the engine on a measurement where the other axis is perfect. */
function axisCaps(m: CenteringMeasurement, axis: "lr" | "tb", side: "front" | "back"): CenteringCap[] | null {
  const one: CenteringMeasurement = {
    ...m,
    leftRight: axis === "lr" ? m.leftRight : 0.5,
    topBottom: axis === "tb" ? m.topBottom : 0.5,
  };
  return safeCaps(side === "back" ? { back: one } : { front: one });
}

function safeCaps(c: CenteringResult): CenteringCap[] | null {
  try {
    return centeringCaps(c);
  } catch {
    return null;
  }
}

function toneFor(caps: CenteringCap[] | null, r: number, side: "front" | "back"): "good" | "warn" | "bad" {
  const psa = caps?.find((c) => c.grader === "PSA");
  if (psa) return psa.maxGrade >= 10 ? "good" : psa.maxGrade >= 9 ? "warn" : "bad";
  // Fallback thresholds (approximate public tolerances) if the engine isn't loaded.
  const ten = side === "back" ? 0.75 : 0.55;
  const nine = side === "back" ? 0.9 : 0.6;
  return r <= ten + 1e-9 ? "good" : r <= nine + 1e-9 ? "warn" : "bad";
}

const TONE_CLASS = { good: "text-good", warn: "text-borderline", bad: "text-bad" } as const;

/* ---------------- component ---------------- */

export function CenteringTool({ side = "front", compact = false, onResult, onImage, className }: CenteringToolProps) {
  const uid = useId();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [outer, setOuter] = useState<Quad | null>(null);
  const [inner, setInner] = useState<Quad | null>(null);
  const [autoConfidence, setAutoConfidence] = useState<number | null>(null);
  const [adjusted, setAdjusted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EdgeId | null>(null);
  const [dragging, setDragging] = useState<EdgeId | null>(null);
  const [dropHover, setDropHover] = useState(false);
  const [displayW, setDisplayW] = useState(0);
  const [loupeAt, setLoupeAt] = useState<"left" | "right">("right");
  const [cameraOpen, setCameraOpen] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastPointer = useRef<Point | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onResultRef = useRef(onResult);
  const onImageRef = useRef(onImage);
  useEffect(() => {
    onResultRef.current = onResult;
    onImageRef.current = onImage;
  });

  const m = useMemo<CenteringMeasurement | null>(() => {
    if (!outer || !inner) return null;
    const r = measure(outer, inner);
    if (adjusted) return { ...r, method: "manual", confidence: 1 };
    return { ...r, method: "auto", confidence: autoConfidence ?? r.confidence };
  }, [outer, inner, adjusted, autoConfidence]);

  // Report the measurement once React has rendered it, and again after each adjustment
  // (but not on every pointer move mid-drag).
  useEffect(() => {
    if (m && loaded && !dragging) onResultRef.current?.(m, loaded.thumb);
  }, [m, loaded, dragging]);

  // Track displayed width (for screen-constant handle sizes).
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setDisplayW(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);

  const ingestCanvas = useCallback(
    async (canvas: HTMLCanvasElement) => {
      setError(null);
      setBusy("Measuring borders…");
      setSelected(null);
      // Yield so the spinner paints before the (synchronous) detector runs.
      await new Promise((r) => setTimeout(r, 30));
      const w = canvas.width;
      const h = canvas.height;
      let url = "";
      try {
        url = canvas.toDataURL("image/jpeg", 0.9);
      } catch {
        setBusy(null);
        setError("Couldn't read that image.");
        return;
      }
      const l: Loaded = { canvas, url, thumb: thumbnail(canvas), w, h };
      let o: Quad;
      let i: Quad;
      let conf = 0;
      try {
        const data = canvasImageData(canvas);
        if (!data) throw new Error("no pixels");
        const det = detectCentering(data);
        o = det.outer;
        i = det.inner;
        conf = det.confidence;
      } catch {
        ({ outer: o, inner: i } = defaultQuads(w, h));
        conf = 0;
      }
      setLoaded(l);
      setOuter(o);
      setInner(i);
      setAutoConfidence(conf);
      setAdjusted(false);
      setBusy(null);
      onImageRef.current?.(canvas);
    },
    [],
  );

  const ingestBlob = useCallback(
    async (blob: Blob) => {
      if (!blob.type.startsWith("image/")) {
        setError("That's not an image. Use a JPG, PNG, or HEIC photo.");
        return;
      }
      setBusy("Loading photo…");
      setError(null);
      try {
        const canvas = await blobToCanvas(blob);
        await ingestCanvas(canvas);
      } catch (e) {
        setBusy(null);
        setError(e instanceof Error ? e.message : "Couldn't load that photo.");
      }
    },
    [ingestCanvas],
  );

  // Live viewfinder when the browser supports it; otherwise the native camera picker.
  const openCamera = useCallback(() => {
    if (cameraSupported()) setCameraOpen(true);
    else cameraRef.current?.click();
  }, []);
  const onCameraCapture = useCallback(
    (canvas: HTMLCanvasElement) => {
      setCameraOpen(false);
      void ingestCanvas(canvas);
    },
    [ingestCanvas],
  );
  const onCameraClose = useCallback(() => setCameraOpen(false), []);
  const onCameraUnavailable = useCallback((reason: string) => {
    setCameraOpen(false);
    setError(reason);
    cameraRef.current?.click();
  }, []);

  const loadSample = useCallback(() => {
    try {
      void ingestCanvas(makeSampleCard());
    } catch {
      setError("Couldn't draw the sample card in this browser.");
    }
  }, [ingestCanvas]);

  // Paste an image from the clipboard (ignored while typing in a field).
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const item = Array.from(e.clipboardData?.items ?? []).find((it) => it.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        void ingestBlob(f);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ingestBlob]);

  /* ----- pointer dragging ----- */

  const toImage = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const svg = svgRef.current;
      if (!svg || !loaded) return null;
      const r = svg.getBoundingClientRect();
      return { x: ((clientX - r.left) / r.width) * loaded.w, y: ((clientY - r.top) / r.height) * loaded.h };
    },
    [loaded],
  );

  const drawLoupe = useCallback(
    (p: Point) => {
      const cv = loupeRef.current;
      const svg = svgRef.current;
      if (!cv || !svg || !loaded || !outer || !inner) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
      if (cv.width !== LOUPE * dpr) {
        cv.width = LOUPE * dpr;
        cv.height = LOUPE * dpr;
      }
      const displayScale = svg.getBoundingClientRect().width / loaded.w; // css px per image px
      const srcSize = LOUPE / ZOOM / displayScale; // image px shown in loupe
      const sx = p.x - srcSize / 2;
      const sy = p.y - srcSize / 2;
      const k = (LOUPE * dpr) / srcSize; // canvas px per image px
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(loaded.canvas, sx, sy, srcSize, srcSize, 0, 0, cv.width, cv.height);
      const line = (q: Quad, color: string) => {
        ctx.beginPath();
        const pts = [q.tl, q.tr, q.br, q.bl];
        pts.forEach((pt, idx) => {
          const x = (pt.x - sx) * k;
          const y = (pt.y - sy) * k;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.stroke();
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeStyle = color;
        ctx.stroke();
      };
      line(outer, "#e8b93a");
      line(inner, "#4cc488");
      // crosshair
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(cv.width / 2, cv.height / 2 - 8 * dpr);
      ctx.lineTo(cv.width / 2, cv.height / 2 + 8 * dpr);
      ctx.moveTo(cv.width / 2 - 8 * dpr, cv.height / 2);
      ctx.lineTo(cv.width / 2 + 8 * dpr, cv.height / 2);
      ctx.stroke();
      ctx.restore();
    },
    [loaded, outer, inner],
  );

  const applyEdge = useCallback(
    (edge: EdgeId, target: number) => {
      if (!loaded) return;
      const [ring, s] = edge.split("-") as [Ring, Side];
      const setter = ring === "outer" ? setOuter : setInner;
      setter((q) => (q ? shiftEdge(q, s, target - edgePos(q, s), loaded.w, loaded.h) : q));
      setAdjusted(true);
    },
    [loaded],
  );

  const onEdgePointerDown = (edge: EdgeId) => (e: ReactPointerEvent<SVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    setSelected(edge);
    setDragging(edge);
    const p = toImage(e.clientX, e.clientY);
    lastPointer.current = p;
    if (p && loaded) setLoupeAt(p.x > loaded.w / 2 ? "left" : "right");
  };

  const onSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const p = toImage(e.clientX, e.clientY);
    if (!p || !loaded) return;
    const s = dragging.split("-")[1] as Side;
    applyEdge(dragging, s === "left" || s === "right" ? p.x : p.y);
    lastPointer.current = p;
    setLoupeAt(p.x > loaded.w / 2 ? "left" : "right");
  };

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setDragging(null);
  };

  // Redraw the loupe after state updates while dragging (lines follow the edge).
  useEffect(() => {
    if (!dragging || !outer || !inner) return;
    const [ring, s] = dragging.split("-") as [Ring, Side];
    const q = ring === "outer" ? outer : inner;
    const pos = edgePos(q, s);
    const [a, b] = edgeEnds(q, s);
    const p = lastPointer.current ?? mid(a, b);
    // Center the loupe on the edge itself, at the finger's position along it.
    drawLoupe(s === "left" || s === "right" ? { x: pos, y: p.y } : { x: p.x, y: pos });
  }, [dragging, outer, inner, drawLoupe]);

  const onEdgeKey = (edge: EdgeId) => (e: ReactKeyboardEvent<SVGElement>) => {
    if (!loaded || !outer || !inner) return;
    const s = edge.split("-")[1] as Side;
    const horizontal = s === "left" || s === "right";
    const step = e.shiftKey ? 10 : 1;
    let d = 0;
    if (e.key === "ArrowLeft") d = horizontal ? -step : 0;
    else if (e.key === "ArrowRight") d = horizontal ? step : 0;
    else if (e.key === "ArrowUp") d = horizontal ? 0 : -step;
    else if (e.key === "ArrowDown") d = horizontal ? 0 : step;
    else return;
    e.preventDefault();
    if (d === 0) return;
    const ring = edge.split("-")[0] as Ring;
    const q = ring === "outer" ? outer : inner;
    applyEdge(edge, edgePos(q, s) + d);
  };

  const reset = () => {
    setLoaded(null);
    setOuter(null);
    setInner(null);
    setAutoConfidence(null);
    setAdjusted(false);
    setSelected(null);
    setError(null);
  };

  const redetect = () => {
    if (loaded) void ingestCanvas(loaded.canvas);
  };

  /* ----- derived display ----- */

  const lrCaps = m ? axisCaps(m, "lr", side) : null;
  const tbCaps = m ? axisCaps(m, "tb", side) : null;
  const allCaps = m ? safeCaps(side === "back" ? { back: m } : { front: m }) : null;
  const lrTone = m ? toneFor(lrCaps, m.leftRight, side) : "good";
  const tbTone = m ? toneFor(tbCaps, m.topBottom, side) : "good";
  const lowConfidence = !adjusted && autoConfidence !== null && autoConfidence < 0.5;
  const k = loaded && displayW > 0 ? loaded.w / displayW : 1; // image px per css px
  const sideLabel = side === "back" ? "Back" : "Front";

  /* ----- render ----- */

  const inputs = (
    <>
      <CameraCapture
        open={cameraOpen}
        sideLabel={sideLabel}
        onCapture={onCameraCapture}
        onClose={onCameraClose}
        onUnavailable={onCameraUnavailable}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void ingestBlob(f);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        id={`${uid}-file`}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void ingestBlob(f);
          e.target.value = "";
        }}
      />
    </>
  );

  if (!loaded) {
    return (
      <div className={clsx("w-full", className)}>
        {inputs}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDropHover(true);
          }}
          onDragLeave={() => setDropHover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropHover(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void ingestBlob(f);
          }}
          className={clsx(
            "flex flex-col items-center justify-center gap-4 rounded-[var(--radius)] border-2 border-dashed bg-card px-4 text-center transition",
            compact ? "py-8" : "py-12",
            dropHover ? "border-ink bg-paper-2" : "border-line",
          )}
        >
          {busy ? (
            <Spinner label={busy} />
          ) : (
            <>
              <div className="flex aspect-[63/88] w-16 items-center justify-center rounded-lg border-2 border-line bg-paper-2 text-ink-3">
                <Camera className="size-6" aria-hidden />
              </div>
              <div>
                <p className="font-display text-lg font-semibold">{sideLabel} photo, straight on</p>
                {!compact ? (
                  <p className="mt-1 text-sm text-ink-2">
                    Out of the sleeve, flat, on a dark surface, filling most of the frame. Drop, paste, or pick a file.
                  </p>
                ) : null}
              </div>
              <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
                <Btn variant="primary" size="lg" onClick={openCamera} className="sm:flex-1">
                  <Camera className="size-5" aria-hidden /> Take photo
                </Btn>
                <Btn size="lg" onClick={() => fileRef.current?.click()} className="sm:flex-1">
                  <ImagePlus className="size-5" aria-hidden /> Upload
                </Btn>
              </div>
              <button
                type="button"
                onClick={loadSample}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline"
              >
                <Sparkles className="size-4" aria-hidden /> No card handy? Try a sample
              </button>
            </>
          )}
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-bad">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={clsx("w-full", className)}>
      {inputs}

      {/* Readout */}
      {m ? (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2" aria-live="polite">
          <p className="font-mono text-2xl font-bold tabular-nums sm:text-3xl">
            <span className="text-ink-3 text-base align-middle">LR </span>
            <span className={TONE_CLASS[lrTone]}>{ratio(m.leftRight)}</span>
            <span className="px-2 text-ink-3">·</span>
            <span className="text-ink-3 text-base align-middle">TB </span>
            <span className={TONE_CLASS[tbTone]}>{ratio(m.topBottom)}</span>
          </p>
          {allCaps ? (
            <ul className="flex flex-wrap gap-1.5">
              {allCaps.map((c) => (
                <li
                  key={c.grader}
                  className={clsx(
                    "rounded-full border px-2.5 py-1 font-mono text-xs font-semibold",
                    c.maxGrade >= 10 ? "border-good/40 text-good" : c.maxGrade >= 9 ? "border-borderline/50 text-borderline" : "border-bad/40 text-bad",
                  )}
                >
                  {c.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {lowConfidence ? (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-borderline/40 bg-borderline-soft px-3 py-2 text-sm text-ink">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Auto-detect wasn&apos;t sure; drag the lines to the card edge and border.
        </p>
      ) : null}

      {/* Image + overlay */}
      <div ref={wrapRef} className="relative mx-auto w-full overflow-hidden rounded-[var(--radius)] border border-line bg-black" style={{ maxWidth: compact ? 420 : 560 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={loaded.url} alt={`${sideLabel} of card`} className="block h-auto w-full select-none" draggable={false} />
        {outer && inner ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${loaded.w} ${loaded.h}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            onPointerMove={onSvgPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            role="group"
            aria-label="Centering lines. Tab to an edge, then use arrow keys to nudge it (Shift for 10px)."
          >
            <QuadPath q={outer} color="var(--slab)" k={k} />
            <QuadPath q={inner} color="var(--good)" k={k} />
            {EDGES.map((edge) => {
              const [ring, s] = edge.split("-") as [Ring, Side];
              const q = ring === "outer" ? outer : inner;
              const [a, b] = edgeEnds(q, s);
              const c = mid(a, b);
              const isSel = selected === edge;
              const horizontal = s === "left" || s === "right";
              const color = ring === "outer" ? "var(--slab)" : "var(--good)";
              // Offset handles along the edge so outer/inner handles don't overlap.
              const along = ring === "outer" ? -0.18 : 0.18;
              const hx = c.x + (b.x - a.x) * along;
              const hy = c.y + (b.y - a.y) * along;
              return (
                <g
                  key={edge}
                  tabIndex={0}
                  role="slider"
                  aria-label={EDGE_LABEL[edge]}
                  aria-orientation={horizontal ? "horizontal" : "vertical"}
                  aria-valuenow={Math.round(edgePos(q, s))}
                  aria-valuemin={0}
                  aria-valuemax={horizontal ? loaded.w : loaded.h}
                  onFocus={() => setSelected(edge)}
                  onKeyDown={onEdgeKey(edge)}
                  className="outline-none"
                  style={{ cursor: horizontal ? "ew-resize" : "ns-resize" }}
                >
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth={28}
                    vectorEffect="non-scaling-stroke"
                    style={{ touchAction: "none" }}
                    onPointerDown={onEdgePointerDown(edge)}
                  />
                  {isSel ? (
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeWidth={3} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                  ) : null}
                  <circle
                    cx={hx}
                    cy={hy}
                    r={(isSel ? 13 : 11) * k}
                    fill={isSel ? "#fff" : color}
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth={2 * k}
                    style={{ touchAction: "none" }}
                    onPointerDown={onEdgePointerDown(edge)}
                  />
                  <path
                    d={
                      horizontal
                        ? `M ${hx - 5 * k} ${hy} l ${3 * k} ${-3 * k} m ${-3 * k} ${3 * k} l ${3 * k} ${3 * k} M ${hx + 5 * k} ${hy} l ${-3 * k} ${-3 * k} m ${3 * k} ${3 * k} l ${-3 * k} ${3 * k}`
                        : `M ${hx} ${hy - 5 * k} l ${-3 * k} ${3 * k} m ${3 * k} ${-3 * k} l ${3 * k} ${3 * k} M ${hx} ${hy + 5 * k} l ${-3 * k} ${-3 * k} m ${3 * k} ${3 * k} l ${3 * k} ${-3 * k}`
                    }
                    stroke={isSel ? "#000" : "rgba(0,0,0,0.75)"}
                    strokeWidth={1.6 * k}
                    fill="none"
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </svg>
        ) : null}

        {/* 4× loupe */}
        <canvas
          ref={loupeRef}
          aria-hidden
          className={clsx(
            "pointer-events-none absolute top-2 rounded-full border-2 border-white shadow-lg transition-opacity",
            loupeAt === "left" ? "left-2" : "right-2",
            dragging ? "opacity-100" : "opacity-0",
          )}
          style={{ width: LOUPE, height: LOUPE }}
        />

        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-card px-3 py-1.5">
              <Spinner label={busy} />
            </span>
          </div>
        ) : null}
      </div>

      {/* Legend + controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-slab" aria-hidden /> Card edge
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-good" aria-hidden /> Border
          </span>
          {m && !compact ? (
            <span className="hidden font-mono text-ink-3 sm:inline">
              L{Math.round(m.borders.left)} R{Math.round(m.borders.right)} T{Math.round(m.borders.top)} B{Math.round(m.borders.bottom)} px
            </span>
          ) : null}
        </div>
        <div className="flex gap-1">
          {adjusted ? (
            <Btn size="sm" variant="ghost" onClick={redetect}>
              <Sparkles className="size-4" aria-hidden /> Auto
            </Btn>
          ) : null}
          <Btn size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="size-4" aria-hidden /> New photo
          </Btn>
        </div>
      </div>
      {!compact ? (
        <p className="mt-2 text-xs text-ink-3">
          Drag any line, or Tab to it and use the arrow keys. Centering is the one thing we can measure from a photo; surface
          flaws need your eyes.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function QuadPath({ q, color, k }: { q: Quad; color: string; k: number }) {
  const d = `M ${q.tl.x} ${q.tl.y} L ${q.tr.x} ${q.tr.y} L ${q.br.x} ${q.br.y} L ${q.bl.x} ${q.bl.y} Z`;
  return (
    <g pointerEvents="none">
      <path d={d} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={4 * k} />
      <path d={d} fill="none" stroke={color} strokeWidth={2 * k} />
    </g>
  );
}

export default CenteringTool;
