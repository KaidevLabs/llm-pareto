import { median } from "./format";
import type { Endpoint, EndpointsMap } from "./types";

// D2 (plan 023): per-model speed = the median of the endpoints' p50
// throughput among endpoints with request_count >= 30 (the rc>=30 floor
// trims only the thin tails — the rc distribution's p25 is 189); latency =
// median p50 latency (ms). The basis — n endpoints used, their summed
// request_count — travels with the value so the tooltip can show the rule
// instead of hiding it.
export interface Speed {
  toks: number;
  latency: number | null;
  n: number;
  rc: number;
}

export function speedOf(modelId: string, eps: EndpointsMap | null): Speed | null {
  const use = ((eps && eps[modelId]) || []).filter(
    (e: Endpoint) =>
      e.stats &&
      e.stats.p50_throughput > 0 &&
      (e.stats.request_count || 0) >= 30
  );
  if (!use.length) return null;
  const toks = median(use.map((e) => e.stats!.p50_throughput));
  if (toks == null) return null;
  return {
    toks,
    latency: median(use.map((e) => e.stats!.p50_latency)),
    n: use.length,
    rc: use.reduce((s, e) => s + (e.stats!.request_count || 0), 0),
  };
}
