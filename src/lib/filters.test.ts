import { describe, it, expect } from "vitest";
import { filterRows, searchHit, blendedPrice } from "./filters";
import type { Row } from "./types";

const row = (over: Partial<Row>): Row =>
  ({
    or_id: "", or_name: "", price_in_per_m: null, price_out_per_m: null,
    vision: false, context_length: null, arena_rank: 0, arena_elo: null,
    arena_elo_upper: null, arena_elo_lower: null, arena_votes: null,
    arena_org: "", arena_license: null, arena_model: null, arena_model_url: null,
    arena_variants: [], arena_context_length: null, arena_price_in_per_m: null,
    arena_price_out_per_m: null, match_method: "", match_ratio: null,
    ...over,
  }) as Row;

// Characterization: values pinned from the real app.js functions
// (harness run 2026-09-18, plan 028 step 1).
describe("filterRows", () => {
  const rows = [
    row({ or_id: "a/foo-bar", or_name: "Alpha: Foo Bar", arena_org: "Alpha", vision: false }),
    row({ or_id: "a/foo-baz", or_name: "Alpha: Foo Baz", arena_org: "Alpha", vision: true }),
    row({ or_id: "b/foo-bar", or_name: "Beta: Foo Bar", arena_org: "Beta", vision: true }),
  ];
  const none = { families: { has: () => false, size: 0 }, vision: "all" as const };
  const pick = (...keys: string[]) => ({
    families: { has: (k: string) => keys.includes(k), size: keys.length },
    vision: "all" as const,
  });
  const ids = (rs: Row[]) => rs.map((r) => r.or_id);

  it("passes everything through with no filters", () => {
    expect(ids(filterRows(rows, none))).toEqual(["a/foo-bar", "a/foo-baz", "b/foo-bar"]);
  });
  it("filters by the org|family leaf key", () => {
    expect(ids(filterRows(rows, pick("Alpha|Foo Bar")))).toEqual(["a/foo-bar"]);
    expect(ids(filterRows(rows, pick("Alpha|Foo Bar", "Beta|Foo Bar")))).toEqual([
      "a/foo-bar", "b/foo-bar",
    ]);
  });
  it("filters vision-capable only", () => {
    expect(ids(filterRows(rows, { ...none, vision: "vision" }))).toEqual([
      "a/foo-baz", "b/foo-bar",
    ]);
  });
});

describe("searchHit", () => {
  const d = row({
    or_name: "Anthropic: Claude Fable 5",
    or_id: "anthropic/claude-fable-5",
    arena_org: "Anthropic",
    arena_model: "claude-fable-5-high",
    arena_variants: ["claude-fable-5-high"],
  });
  // the query arrives lowercase (the app lowercases at input)
  it("matches lowercase substrings across all name surfaces", () => {
    expect(searchHit(d, "")).toBe(true);
    expect(searchHit(d, "fable")).toBe(true);
    expect(searchHit(d, "high")).toBe(true);
    expect(searchHit(d, "claude")).toBe(true);
    expect(searchHit(d, "anthropic/")).toBe(true);
  });
  it("rejects non-matches and non-lowercase queries", () => {
    expect(searchHit(d, "gpt")).toBe(false);
    expect(searchHit(d, "x/y")).toBe(false);
    expect(searchHit(d, "CLAUDE")).toBe(false);
  });
});

describe("blendedPrice", () => {
  it("blends in/out at the ratio weight", () => {
    expect(blendedPrice(row({ price_in_per_m: 10, price_out_per_m: 30 }), 3)).toBe(15);
    expect(blendedPrice(row({ price_in_per_m: 10, price_out_per_m: 30 }), 1)).toBe(20);
    expect(blendedPrice(row({ price_in_per_m: 10, price_out_per_m: 30 }), 10)).toBeCloseTo(11.818181818181818, 12);
  });
  it("falls back to the available price", () => {
    expect(blendedPrice(row({ price_in_per_m: 10, price_out_per_m: null }), 3)).toBe(10);
    expect(blendedPrice(row({ price_in_per_m: null, price_out_per_m: 30 }), 3)).toBe(30);
    expect(blendedPrice(row({ price_in_per_m: null, price_out_per_m: null }), 3)).toBe(null);
  });
});
