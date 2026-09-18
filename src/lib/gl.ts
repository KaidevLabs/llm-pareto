// echarts-gl is injected on demand only — 2D-only visits never download it.
// Same promise-cached pattern as the endpoints store (023 D5); the promise
// resolves true when the UMD global registered (the factory wires
// grid3D/scatter3D/lines3D onto the global echarts), false on any failure —
// a failed load must leave the 2D views untouched (the 3D pill reports it).
// The chart instance must be created only AFTER this resolves: one
// initialized before the extension loads crashes on its first GL render
// (#468, found by headless bisection 2026-09-17).

let glPromise: Promise<boolean> | null = null;

declare global {
  interface Window {
    "echarts-gl"?: unknown;
  }
}

export function loadEchartsGL(): Promise<boolean> {
  if (!glPromise) {
    glPromise = new Promise((resolve) => {
      if (window["echarts-gl"]) return resolve(true);
      const s = document.createElement("script");
      s.src = "./js/echarts-gl-2.1.0.min.js";
      s.onload = () => resolve(!!window["echarts-gl"]);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }
  return glPromise;
}
