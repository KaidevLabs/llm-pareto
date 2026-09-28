// echarts-gl is imported on demand only — 2D-only visits never download it.
// The dynamic import makes vite emit it as a separate lazy chunk (040 D2),
// fetched on first 3D entry; the module's evaluation wires
// grid3D/scatter3D/lines3D onto the shared echarts core (same module
// instance through ./echarts). Same promise-cached pattern as the endpoints
// store (023 D5); the promise resolves true when the chunk registered,
// false on any failure — a failed load must leave the 2D views untouched
// (the 3D pill reports it). The chart instance must be created only AFTER
// this resolves: one initialized before the extension loads crashes on its
// first GL render (#468, found by headless bisection 2026-09-17) —
// render3DPanel's .then keeps that order.

let glPromise: Promise<boolean> | null = null;

export function loadEchartsGL(): Promise<boolean> {
  if (!glPromise) {
    glPromise = import("echarts-gl")
      .then(() => true)
      .catch(() => false);
  }
  return glPromise;
}
