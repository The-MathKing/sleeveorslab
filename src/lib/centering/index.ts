// CONTRACT (owned by engines agent). Pure image analysis on ImageData-like input; runs in browser
// (canvas) and in tests (synthetic buffers). No DOM access inside this module.
import type { CenteringMeasurement, Quad } from "@/lib/types";

export interface ImageLike { width: number; height: number; data: Uint8ClampedArray } // RGBA
/** Auto-detect outer card edge and inner border, return measurement with confidence. */
export declare function detectCentering(img: ImageLike): CenteringMeasurement;
/** Recompute measurement from user-adjusted quads (manual mode). */
export declare function measureFromQuads(outer: Quad, inner: Quad): CenteringMeasurement;
/** Format 0.55 -> "55/45". */
export declare function formatRatio(r: number): string;
