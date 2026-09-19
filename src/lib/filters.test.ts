import { describe, it, expect } from "vitest";
import { filterRows, searchHit, blendedPrice, passThresholds } from "./filters";
import type { Thr } from "./filters";
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

describe("passThresholds", () => {
  // worked example: in 10, out 30, ratio 3 → blended = 0.75*10 + 0.25*30 = 15
  const d = row({ or_id: "a/x", price_in_per_m: 10, price_out_per_m: 30, arena_elo: 1400 });
  const ctx = (over: Partial<{ ratio: number; mode: "general" | "in" | "out" | "speed" | "3d"; speed: (id: string) => { toks: number } | null }> = {}) => ({
    ratio: 3,
    mode: "general" as const,
    speed: (_id: string): { toks: number } | null => ({ toks: 100 }),
    ...over,
  });
  const noThr: Thr = { priceMin: null, priceMax: null, eloMin: null, speedMin: null };

  it("passes everything with no thresholds", () => {
    expect(passThresholds(d, noThr, ctx())).toBe(true);
  });
  it("price min/max measure the blended price in general mode", () => {
    expect(passThresholds(d, { ...noThr, priceMin: 15 }, ctx())).toBe(true);
    expect(passThresholds(d, { ...noThr, priceMin: 15.01 }, ctx())).toBe(false);
    expect(passThresholds(d, { ...noThr, priceMax: 15 }, ctx())).toBe(true);
    expect(passThresholds(d, { ...noThr, priceMax: 14.99 }, ctx())).toBe(false);
  });
  it("in/out modes measure the view's own price", () => {
    expect(passThresholds(d, { ...noThr, priceMin: 10 }, ctx({ mode: "in" }))).toBe(true);
    expect(passThresholds(d, { ...noThr, priceMin: 10.5 }, ctx({ mode: "in" }))).toBe(false);
    expect(passThresholds(d, { ...noThr, priceMax: 30 }, ctx({ mode: "out" }))).toBe(true);
    expect(passThresholds(d, { ...noThr, priceMax: 25 }, ctx({ mode: "out" }))).toBe(false);
  });
  it("speed mode leaves the price threshold inactive (D2)", () => {
    expect(passThresholds(d, { ...noThr, priceMin: 1000 }, ctx({ mode: "speed" }))).toBe(true);
  });
  it("a price-less row fails an active price bound", () => {
    expect(passThresholds(row({ or_id: "b/y" }), { ...noThr, priceMin: 0.01 }, ctx())).toBe(false);
  });
  it("elo min culls below and missing Elo", () => {
    expect(passThresholds(d, { ...noThr, eloMin: 1400 }, ctx())).toBe(true);
    expect(passThresholds(d, { ...noThr, eloMin: 1400.5 }, ctx())).toBe(false);
    expect(passThresholds(row({ or_id: "b/y" }), { ...noThr, eloMin: 100 }, ctx())).toBe(false);
  });
  it("speed min culls below and missing speed (D2 ctx speed fn)", () => {
    expect(passThresholds(d, { ...noThr, speedMin: 100 }, ctx())).toBe(true);
    expect(passThresholds(d, { ...noThr, speedMin: 100.5 }, ctx())).toBe(false);
    expect(passThresholds(d, { ...noThr, speedMin: 1 }, ctx({ speed: () => null }))).toBe(false);
  });
  it("bounds compose additively", () => {
    expect(passThresholds(d, { ...noThr, priceMin: 15, eloMin: 1400, speedMin: 100 }, ctx())).toBe(true);
    expect(passThresholds(d, { ...noThr, priceMin: 15, eloMin: 1400.5 }, ctx())).toBe(false);
  });
});

describe("filterRows + thresholds", () => {
  const rows = [
    row({ or_id: "cheap", price_in_per_m: 1, price_out_per_m: 3, arena_elo: 1200 }),
    row({ or_id: "dear", price_in_per_m: 10, price_out_per_m: 30, arena_elo: 1400 }),
  ];
  const none = { families: { has: () => false, size: 0 }, vision: "all" as const };
  const thrCtx = {
    ratio: 3,
    mode: "general" as const,
    speed: (): { toks: number } | null => null,
  };
  it("thresholds cull additively with families/vision", () => {
    expect(filterRows(rows, { ...none, thr: { priceMin: 5, priceMax: null, eloMin: null, speedMin: null }, thrCtx })).toEqual([
      rows[1],
    ]);
    expect(
      filterRows(rows, {
        ...none,
        vision: "vision",
        thr: { priceMin: 5, priceMax: null, eloMin: null, speedMin: null },
        thrCtx,
      }),
    ).toEqual([]);
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
