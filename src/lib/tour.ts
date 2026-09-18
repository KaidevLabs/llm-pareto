// Guided 3D tour (027 step 2): a self-running camera flight through the 3D
// showcase. echarts-gl 2.1.0 has no camera-tween API, so the flight is a
// rAF loop lerping viewControl alpha/beta/distance per segment with
// ease-in-out, pushing each frame through chart.setOption in MERGE mode
// (the option carries only grid3D.viewControl — the scene itself is never
// re-set). Captions are DOM chrome owned by the caller (Panel.svelte);
// this module only reports them through onCaption ("" = clear).
//
// The controller is a pure state machine over an injectable ticker (the
// rAF clock) so tests drive it without echarts. cancel() stops the camera
// where it is (the scene's idle autoRotate resumes by its own default) —
// never snaps back. Tour state is module-local: not ui state, not URL
// state (A5: `tour=1` is an entry action, stripped from the URL before
// the first history entry).

export interface Waypoint {
  alpha: number;
  beta: number;
  distance: number;
  // the point the camera looks at (grid3D viewControl.center, in the
  // scene's pre-transformed value space); lerped like the spherical coords
  center?: [number, number, number];
  caption: string;
  hold: number;
}

export interface TourChart {
  setOption(opt: unknown): void;
}

// The real rAF clock; injectable so tests drive the flight deterministically.
export const rafTicker = (): Ticker => ({
  now: () => performance.now(),
  raf: (cb) => requestAnimationFrame(cb),
});

export interface Ticker {
  now(): number;
  raf(cb: (t: number) => void): number;
}

export interface TourOpts {
  waypoints: Waypoint[];
  ticker: Ticker;
  segmentMs?: number;
  onCaption?: (s: string) => void;
  onDone?: () => void;
}

export interface Tour {
  cancel(): void;
}

const easeInOut = (x: number): number =>
  x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

// The camera takes the shortest arc in echarts-gl's spherical coords:
// alpha (azimuth) wraps at ±180° so a tour never spins the long way round;
// beta is clamped by echarts-gl itself.
function shortestArc(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function startTour(chart: TourChart, opts: TourOpts): Tour {
  const segmentMs = opts.segmentMs ?? 1600;
  const wps = opts.waypoints;
  let cancelled = false;
  let rafId: number | null = null;
  let segStart = 0;
  let segIdx = -1; // index of the waypoint currently flying toward
  let phase: "fly" | "hold" | "between" = "between";
  let from: Required<Pick<Waypoint, "alpha" | "beta" | "distance">> & { center?: [number, number, number] } = ORIGIN;
  let holdStart = 0;

  const push = (alpha: number, beta: number, distance: number, center?: [number, number, number]) => {
    chart.setOption({
      grid3D: { viewControl: center ? { alpha, beta, distance, center } : { alpha, beta, distance } },
    });
  };

  const frame = (t: number) => {
    if (cancelled) return;
    if (phase === "between") {
      segStart = t;
      segIdx += 1;
      phase = "fly";
      if (segIdx > 0) opts.onCaption?.(""); // leaving the previous caption
      frame(t);
      return;
    }
    if (phase === "fly") {
      const wp = wps[segIdx];
      const p = Math.min(1, (t - segStart) / segmentMs);
      const e = easeInOut(p);
      const to = wp.center ?? from.center ?? [0, 0, 0];
      const fc = from.center ?? to;
      push(
        from.alpha + shortestArc(from.alpha, wp.alpha) * e,
        from.beta + (wp.beta - from.beta) * e,
        from.distance + (wp.distance - from.distance) * e,
        [0, 1, 2].map((i) => fc[i] + (to[i] - fc[i]) * e) as [number, number, number]
      );
      if (p >= 1) {
        if (wp.caption) opts.onCaption?.(wp.caption);
        phase = "hold";
        holdStart = t;
      }
    } else if (phase === "hold") {
      const wp = wps[segIdx];
      if (t - holdStart >= wp.hold) {
        if (segIdx + 1 >= wps.length) {
          opts.onDone?.();
          return;
        }
        from = {
          alpha: wp.alpha,
          beta: wp.beta,
          distance: wp.distance,
          center: wp.center ?? from.center,
        };
        segStart = t;
        segIdx += 1;
        phase = "fly";
        if (wp.caption) opts.onCaption?.(""); // clear the old caption in flight
      }
    }
    rafId = opts.ticker.raf(frame);
  };

  if (!wps.length) {
    opts.onDone?.();
    return { cancel: () => {} };
  }

  rafId = opts.ticker.raf(frame);
  return {
    cancel() {
      cancelled = true;
      rafId = null;
    },
  };
}

// Camera origin for the first segment when the caller has no live read:
// echarts-gl's default view; this scene's shipped viewControl distance.
// `center` stays undefined — the scene's default (box center) applies until
// the first waypoint with an explicit center is flown.
export const ORIGIN = { alpha: -45, beta: 30, distance: 230 };
