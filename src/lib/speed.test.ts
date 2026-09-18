import { describe, it, expect } from "vitest";
import { speedOf } from "./speed";
import type { EndpointsMap } from "./types";

// Characterization: values pinned from the real app.js functions
// (harness run 2026-09-18, plan 028 step 1).
const ep = (toks: number, lat: number, rc: number) => ({
  provider: "p",
  stats: {
    p50_throughput: toks, p50_latency: lat,
    p75_throughput: 0, p75_latency: 0, p90_throughput: 0, p90_latency: 0,
    p95_throughput: 0, p95_latency: 0, p99_throughput: 0, p99_latency: 0,
    request_count: rc, window_minutes: 30,
  },
});

describe("speedOf", () => {
  it("aggregates medians over the rc>=30, throughput>0 endpoints", () => {
    const eps: EndpointsMap = {
      m: [ep(81, 940, 1200), ep(60, 800, 20), ep(0, 700, 100), { provider: "no-stats" }, ep(90, 800, 30)],
    };
    expect(speedOf("m", eps)).toEqual({ toks: 85.5, latency: 870, n: 2, rc: 1230 });
  });
  it("passes single-endpoint models straight through", () => {
    expect(speedOf("single", { single: [ep(81, 940, 1200)] })).toEqual({
      toks: 81, latency: 940, n: 1, rc: 1200,
    });
  });
  it("returns null for empty, unknown, or missing maps", () => {
    expect(speedOf("empty", { empty: [] })).toBe(null);
    expect(speedOf("nope", { m: [ep(81, 940, 1200)] })).toBe(null);
    expect(speedOf("m", null)).toBe(null);
  });
});
