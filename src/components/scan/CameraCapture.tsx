"use client";
// Live phone-camera viewfinder with a card-shaped guide. Watches the frame on-device and
// snaps automatically once a card is lined up and held steady; the shutter works any time.
// Frames never leave the device.
import { Camera, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { detectCentering } from "@/lib/centering";
import { drawScaled, MAX_SIDE } from "./image";

/** Consecutive steady checks needed before auto-capture (~1.2s at CHECK_MS). */
const STEADY_CHECKS = 4;
const CHECK_MS = 300;
const MIN_CONFIDENCE = 0.45;
/** Max frame-to-frame change (as a share) still counted as "steady". */
const STEADY_DELTA = 0.015;
/** Extra margin around the guide when cropping, so the card edge is inside the shot. */
const CROP_MARGIN = 0.12;

type Status = "starting" | "searching" | "align" | "steady" | "captured" | "error";

const STATUS_COPY: Record<Status, string> = {
  starting: "Starting camera…",
  searching: "Point at the card, flat on a dark surface",
  align: "Fill the frame with the card",
  steady: "Hold steady…",
  captured: "Got it",
  error: "",
};

export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

interface Props {
  open: boolean;
  sideLabel: string;
  onCapture: (canvas: HTMLCanvasElement) => void;
  onClose: () => void;
  /** Called when the live camera can't start, so the caller can fall back to the native picker. */
  onUnavailable: (reason: string) => void;
}

export function CameraCapture({ open, sideLabel, onCapture, onClose, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const shutterRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [steady, setSteady] = useState(0);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [auto, setAuto] = useState(true);
  const doneRef = useRef(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Start / restart the stream.
  useEffect(() => {
    if (!open) return;
    doneRef.current = false;
    setStatus("starting");
    setSteady(0);
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setStatus("searching");
        shutterRef.current?.focus();
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : "";
        onUnavailable(
          name === "NotAllowedError"
            ? "Camera access was blocked. You can still take a photo with your camera app."
            : "Couldn't start the live camera. Using your camera app instead.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, facing, onUnavailable, stop]);

  /** Crop the current video frame to the guide (+margin), in video pixels. */
  const grab = useCallback((maxSide: number): HTMLCanvasElement | null => {
    const v = videoRef.current;
    const g = guideRef.current;
    if (!v || !g || !v.videoWidth) return null;
    const vr = v.getBoundingClientRect();
    const gr = g.getBoundingClientRect();
    // <video> uses object-fit: cover; map element coords back to video pixels.
    const s = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight);
    const ox = (vr.width - v.videoWidth * s) / 2;
    const oy = (vr.height - v.videoHeight * s) / 2;
    const mx = gr.width * CROP_MARGIN;
    const my = gr.height * CROP_MARGIN;
    const x0 = Math.max(0, (gr.left - vr.left - mx - ox) / s);
    const y0 = Math.max(0, (gr.top - vr.top - my - oy) / s);
    const x1 = Math.min(v.videoWidth, (gr.right - vr.left + mx - ox) / s);
    const y1 = Math.min(v.videoHeight, (gr.bottom - vr.top + my - oy) / s);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 20 || h < 20) return null;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    if (facing === "user") {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, x0, y0, w, h, 0, 0, c.width, c.height);
    return c;
  }, [facing]);

  const capture = useCallback(() => {
    if (doneRef.current) return;
    const c = grab(MAX_SIDE);
    if (!c) return;
    doneRef.current = true;
    setStatus("captured");
    try {
      navigator.vibrate?.(30);
    } catch {
      /* not supported */
    }
    stop();
    onCapture(drawScaled(c, c.width, c.height));
  }, [grab, onCapture, stop]);

  // Auto-capture loop: detect on a small frame, snap after STEADY_CHECKS steady readings.
  // Keyed on `live` (not `status`) so status-text changes don't reset the steady count.
  const live = status !== "starting" && status !== "captured" && status !== "error";
  useEffect(() => {
    if (!open || !auto || !live) return;
    let prev: { lr: number; tb: number; l: number; t: number } | null = null;
    let count = 0;
    const id = window.setInterval(() => {
      const c = grab(480);
      const ctx = c?.getContext("2d", { willReadFrequently: true });
      if (!c || !ctx) return;
      const m = detectCentering(ctx.getImageData(0, 0, c.width, c.height));
      const cardW = m.outer.tr.x - m.outer.tl.x;
      const filling = cardW / c.width > 0.6;
      if (m.confidence < MIN_CONFIDENCE) {
        count = 0;
        prev = null;
        setSteady(0);
        setStatus("searching");
        return;
      }
      if (!filling) {
        count = 0;
        setSteady(0);
        setStatus("align");
        return;
      }
      const cur = { lr: m.leftRight, tb: m.topBottom, l: m.outer.tl.x / c.width, t: m.outer.tl.y / c.height };
      const still =
        prev &&
        Math.abs(cur.lr - prev.lr) < STEADY_DELTA &&
        Math.abs(cur.tb - prev.tb) < STEADY_DELTA &&
        Math.abs(cur.l - prev.l) < STEADY_DELTA &&
        Math.abs(cur.t - prev.t) < STEADY_DELTA;
      count = still ? count + 1 : 0;
      prev = cur;
      setSteady(count);
      setStatus("steady");
      if (count >= STEADY_CHECKS) {
        window.clearInterval(id);
        capture();
      }
    }, CHECK_MS);
    return () => window.clearInterval(id);
  }, [open, auto, live, grab, capture]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const progress = Math.min(1, steady / STEADY_CHECKS);
  const guideTone =
    status === "steady" || status === "captured" ? "border-good" : status === "align" ? "border-borderline" : "border-white/80";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${sideLabel} photo camera`}
      className="fixed inset-0 z-[70] flex flex-col bg-black text-white"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
      />

      {/* Card guide: 63:88, darkened surround. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 pb-40 pt-20">
        <div
          ref={guideRef}
          className={`relative aspect-[63/88] rounded-[4%] border-[3px] transition-colors ${guideTone}`}
          // Largest true-ratio card that fits both the width and the height left by the controls
          // (pt-20 + pb-40 = 15rem); sizing by width keeps the 63:88 shape on narrow phones.
          style={{ width: "min(100%, calc((100dvh - 15rem) * 63 / 88))", boxShadow: "0 0 0 100vmax rgb(0 0 0 / 0.55)" }}
        >
          {/* corner ticks */}
          {["left-0 top-0 border-l-4 border-t-4", "right-0 top-0 border-r-4 border-t-4", "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4"].map((c) => (
            <span key={c} className={`absolute -m-1 size-7 rounded-sm border-white ${c}`} aria-hidden />
          ))}
        </div>
      </div>

      {/* Top bar */}
      <div className="relative flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur"
          aria-label="Close camera"
        >
          <X className="size-5" aria-hidden />
        </button>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/80">{sideLabel} · straight on</p>
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          className="flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur"
          aria-label="Switch camera"
        >
          <RefreshCw className="size-5" aria-hidden />
        </button>
      </div>

      {/* Bottom controls */}
      <div className="relative mt-auto flex flex-col items-center gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="min-h-6 rounded-full bg-black/55 px-4 py-1.5 text-center text-sm font-semibold backdrop-blur" aria-live="polite">
          {STATUS_COPY[status]}
        </p>
        <div className="flex w-full max-w-xs items-center justify-between">
          <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-white/85">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-white" />
            Auto-snap
          </label>
          <button
            ref={shutterRef}
            type="button"
            onClick={capture}
            disabled={status === "starting"}
            aria-label="Take photo"
            className="relative flex size-20 items-center justify-center rounded-full border-4 border-white disabled:opacity-50"
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80" aria-hidden>
              <circle cx="40" cy="40" r="36" fill="none" stroke="var(--good)" strokeWidth="5" strokeDasharray={`${progress * 226} 226`} />
            </svg>
            <span className="size-14 rounded-full bg-white" />
          </button>
          <span className="flex w-[5.5rem] justify-end">
            <Camera className="size-5 text-white/50" aria-hidden />
          </span>
        </div>
        <p className="text-center text-[11px] text-white/60">No flash or sleeve: glare hides the border. The photo stays on this device.</p>
      </div>
    </div>
  );
}
