// Types for the joined data surface (public/data/*, written by update.py).
// Only the fields the app consumes are typed; extra JSON fields pass through.

export interface Row {
  or_id: string;
  or_name: string;
  price_in_per_m: number | null;
  price_out_per_m: number | null;
  vision: boolean;
  context_length: number | null;
  arena_rank: number;
  arena_elo: number | null;
  arena_elo_upper: number | null;
  arena_elo_lower: number | null;
  arena_votes: number | null;
  arena_org: string;
  arena_license: string | null;
  arena_model: string | null;
  arena_model_url: string | null;
  arena_variants: string[];
  arena_context_length: number | null;
  arena_price_in_per_m: number | null;
  arena_price_out_per_m: number | null;
  match_method: string;
  match_ratio: number | null;
}

export interface Meta {
  fetched_at: string;
  logos: Record<string, string>;
  join: {
    combined: number;
    unmatched_arena: number;
    unmatched_openrouter: number;
    by_method: Record<string, number>;
    overrides_applied?: { arena: string; openrouter_id: string }[];
  };
}

export type Pct = "p50" | "p75" | "p90" | "p95" | "p99";

export type EndpointStats = {
  [k in `${Pct}_throughput` | `${Pct}_latency`]: number;
} & {
  request_count: number;
  window_minutes?: number;
};

export interface Endpoint {
  provider: string;
  tag?: string;
  model_id?: string;
  pricing?: { prompt?: string; completion?: string; discount?: number };
  context_length?: number | null;
  quantization?: string | null;
  uptime_last_1d?: number | null;
  status?: number;
  stats?: EndpointStats | null;
}

export type EndpointsMap = Record<string, Endpoint[]>;
