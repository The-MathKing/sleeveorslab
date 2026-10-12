// Pure image analysis on ImageData-like input; runs in browser (canvas) and in
// tests (synthetic buffers). No DOM access inside this module.
export type { ImageLike } from "./detect";
export { detectCentering, defaultMeasurement, DETECT_LONG_SIDE_PX, MIN_BORDER_FRACTION, MAX_BORDER_FRACTION } from "./detect";
export { measureFromQuads, rectQuad } from "./quads";
export { formatRatio, ratioOf } from "./format";
