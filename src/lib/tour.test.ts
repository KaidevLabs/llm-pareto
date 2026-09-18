// Tour engine tests (027 step 2) — the controller as a pure state machine
// driven by a fake chart (records setOption calls) and a fake clock. No
// echarts import: the flight drives viewControl through the fake, exactly
// as it drives the real instance.

import { describe, it, expect, vi } from "vitest";
import { startTour, type TourChart } from "./tour";

// --- fakes -----------------------------------------------------------------

function fakeChart() {
  const calls: Array<Record<string, unknown>> = [];
  const chart: TourChart = {
    setOption: (opt: Record<string, unknown>) => {
      calls.push(opt);
    },
  };
  return { chart, calls };
}

// The controller accepts an injectable clock/ticker; the fake advances time
// in fixed steps, firing rAF callbacks.
function fakeTicker() {
  let now = 0;
  const rafs: Array<(t: number) => void> = [];
  const ticker = {
    now: () => now,
    raf: (cb: (t: number) => void) => {
      rafs.push(cb);
      return rafs.length;
    },
    // advance the clock by `ms`, firing each queued rAF once per frame step
    step: (ms: number, fps = 60) => {
      const frames = Math.max(1, Math.round((fps * ms) / 1000));
      for (let f = 0; f < frames; f++) {
        now += 1000 / fps;
        const queued = rafs.splice(0);
        for (const cb of queued) cb(now);
      }
    },
  };
  return ticker;
}

const WP = (over: Partial<{ alpha: number; beta: number; distance: number; caption: string; hold: number }> = {}) => ({
  alpha: -45,
  beta: 30,
  distance: 230,
  caption: "",
  hold: 400,
  ...over,
});

// --- tests -----------------------------------------------------------------

describe("tour startTour", () => {
  it("flies toward waypoint 1: setOption viewControl values move toward the target and stop there", () => {
    const { chart, calls } = fakeChart();
    const t = fakeTicker();
    startTour(chart, { waypoints: [WP({ alpha: 45, distance: 120, hold: 0 })], ticker: t, segmentMs: 1000 });
    t.step(2000);
    const last = calls.at(-1) as any;
    expect(last.grid3D.viewControl.alpha).toBeCloseTo(45);
    expect(last.grid3D.viewControl.distance).toBeCloseTo(120);
    // arrival means the flight stopped pushing new values
    const count = calls.length;
    t.step(500);
    expect(calls.length).toBe(count);
  });

  it("eases: mid-flight values are strictly between start and target (no snap)", () => {
    const { chart, calls } = fakeChart();
    const t = fakeTicker();
    startTour(chart, { waypoints: [WP({ alpha: 45, distance: 120, hold: 0 })], ticker: t, segmentMs: 1000 });
    t.step(400); // ~40% through the segment
    const mid = calls.at(-1) as any;
    expect(mid.grid3D.viewControl.alpha).toBeGreaterThan(-45);
    expect(mid.grid3D.viewControl.alpha).toBeLessThan(45);
    expect(mid.grid3D.viewControl.distance).toBeGreaterThan(120);
    expect(mid.grid3D.viewControl.distance).toBeLessThan(230);
  });

  it("sequences waypoints: after segment+hold, the second target is reached", () => {
    const { chart, calls } = fakeChart();
    const t = fakeTicker();
    startTour(
      chart,
      {
        waypoints: [WP({ alpha: 45, hold: 100 }), WP({ alpha: -120, beta: 70, distance: 90 })],
        ticker: t,
        segmentMs: 500,
      }
    );
    t.step(700); // segment 1 (500) + hold (100) — the last frame may land
    // just short of the exact target (16.7ms frame quantization), so sample
    // the closest push to 45 rather than the literal last one
    const near = calls
      .map((c) => (c as any).grid3D.viewControl.alpha)
      .reduce((a, b) => (Math.abs(b - 45) < Math.abs(a - 45) ? b : a));
    expect(near).toBeCloseTo(45, 1);
    t.step(2000); // segment 2 complete
    const second = calls.at(-1) as any;
    expect(second.grid3D.viewControl.alpha).toBeCloseTo(-120);
    expect(second.grid3D.viewControl.beta).toBeCloseTo(70);
    expect(second.grid3D.viewControl.distance).toBeCloseTo(90);
  });

  it("fires onDone after the last waypoint's hold, exactly once", () => {
    const { chart } = fakeChart();
    const t = fakeTicker();
    const onDone = vi.fn();
    startTour(chart, { waypoints: [WP({ hold: 300 })], ticker: t, segmentMs: 500, onDone });
    t.step(500);
    expect(onDone).not.toHaveBeenCalled();
    t.step(500);
    expect(onDone).toHaveBeenCalledTimes(1);
    t.step(500);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("cancel() mid-flight stops the camera where it is and stops onDone", () => {
    const { chart, calls } = fakeChart();
    const t = fakeTicker();
    const onDone = vi.fn();
    const tour = startTour(chart, { waypoints: [WP({ alpha: 45, hold: 0 })], ticker: t, segmentMs: 1000, onDone });
    t.step(400);
    tour.cancel();
    const atCancel = calls.length;
    const last = calls.at(-1) as any;
    expect(last.grid3D.viewControl.alpha).toBeGreaterThan(-45); // partway, not snapped
    t.step(1500);
    expect(calls.length).toBe(atCancel); // frozen
    expect(onDone).not.toHaveBeenCalled();
  });

  it("reports captions: caption callback fires on waypoint arrival and clear fires when it leaves", () => {
    const { chart } = fakeChart();
    const t = fakeTicker();
    const captions: string[] = [];
    startTour(
      chart,
      {
        waypoints: [WP({ caption: "cheap shelf", hold: 100 }), WP({ caption: "fast shelf", hold: 100 })],
        ticker: t,
        segmentMs: 500,
        onCaption: (s) => captions.push(s),
      }
    );
    t.step(700);
    expect(captions).toContain("cheap shelf");
    t.step(1200); // into segment 2: caption 1 must have cleared (empty push)
    expect(captions).toContain("");
    t.step(1200);
    expect(captions).toContain("fast shelf");
  });
});
