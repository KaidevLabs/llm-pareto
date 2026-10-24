import { median } from "./format";
import type { Endpoint, EndpointsMap } from "./types";

// D2 (plan 023): per-model speed = the median of the endpoints' p50
// throughput among the endpoints eligible for it (p50 > 0 and a throughput
// sample of at least SPEED_MIN_REQUESTS — the floor is the *throughput*
// sample; request_count counts latency samples only, 047 step 01b).
// Latency = median p50 latency (ms). The basis — n endpoints used, their
// summed throughput_request_count — travels with the value so the tooltip
// can show the rule instead of hiding it.
export const SPEED_MIN_REQUESTS = 30;

export interface Speed {
  toks: number;
  latency: number | null;
  n: number;
  rc: number;
}

export function speedEligible(e: Endpoint): boolean {
  return (
    !!e.stats &&
    e.stats.p50_throughput > 0 &&
    (e.stats.throughput_request_count || 0) >= SPEED_MIN_REQUESTS
  );
}

export function speedOf(modelId: string, eps: EndpointsMap | null): Speed | null {
  const use = ((eps && eps[modelId]) || []).filter(speedEligible);
  if (!use.length) return null;
  const toks = median(use.map((e) => e.stats!.p50_throughput));
  if (toks == null) return null;
  return {
    toks,
    latency: median(use.map((e) => e.stats!.p50_latency)),
    n: use.length,
    rc: use.reduce((s, e) => s + (e.stats!.throughput_request_count || 0), 0),
  };
}
