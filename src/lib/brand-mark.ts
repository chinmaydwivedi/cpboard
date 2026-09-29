/**
 * CPBoard's "CPB" circle monogram, drawn on a 512×512 grid.
 *
 * The letters fill a circle (r = 224) and are separated by two vertical gaps.
 * C's mouth and B's bowls follow inner circles, so strokes stay even along the
 * curve; P runs the full height and carries the brand red. Each path uses the
 * even-odd rule so counters are real holes (transparent background).
 *
 * This is the single source for the mark: `src/components/logo.tsx` renders it
 * inline, and `npm run brand:icons` regenerates every icon file from it.
 */
export const BRAND_MARK_PATHS = {
  c: "M166 50.88A224 224 0 0 0 166 461.12L166 340L108.2 340A170 170 0 0 1 108.2 172L166 172Z",
  p: "M190 41.94A224 224 0 0 1 322 41.94L322 290L244 290L244 479.68A224 224 0 0 1 190 470.06ZM244 90L265 90A21 21 0 0 1 286 111L286 219A21 21 0 0 1 265 240L244 240Z",
  b: "M346 50.88A224 224 0 0 1 478.49 230L450.49 256L478.49 282A224 224 0 0 1 346 461.12ZM388 124.96A186 186 0 0 1 440.81 235L388 235ZM388 277L440.81 277A186 186 0 0 1 388 387.04Z",
} as const;

export const BRAND_COLORS = {
  red: "#ed3151",
  ink: "#f4f4f5",
  inkOnLight: "#111318",
} as const;
