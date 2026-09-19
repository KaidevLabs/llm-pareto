import { describe, it, expect } from "vitest";
import { buildMarks, resolvedCmps, band, CMP_MAX } from "./comparator";
import type { Row } from "./types";
import type { Speed } from "./speed";

// Synthetic fixtures (never real page snapshots). or_name carries the
// "Org: " prefix the display names strip.
const base: Row = {
  or_id: "orga/alpha",
  or_name: "OrgA: Alpha",
  price_in_per_m: 10,
  price_out_per_m: 50,
  vision: false,
  context_length: 1000000,
  arena_rank: 1,
  arena_elo: 1500,
  arena_elo_upper: 1505,
  arena_elo_lower: 1495,
  arena_votes: 30000,
  arena_org: "OrgA",
  arena_license: "Proprietary",
  arena_model: null,
  arena_model_url: null,
  arena_variants: [],
  arena_context_length: null,
  arena_price_in_per_m: null,
  arena_price_out_per_m: null,
  match_method: "exact",
  match_ratio: null,
};
const beta: Row = {
  ...base,
  or_id: "orgb/beta",
  or_name: "OrgB: Beta",
  arena_rank: 2,
  arena_elo: 1504.6,
  arena_elo_upper: 1508.1,
  arena_elo_lower: 1501.1,
  arena_votes: 72000,
  price_in_per_m: 5,
  price_out_per_m: 25,
  vision: true,
  arena_org: "OrgB",
};
const gamma: Row = {
  ...base,
  or_id: "orgc/gamma",
  or_name: "OrgC: Gamma",
  arena_rank: 3,
  arena_elo: 1480,
  arena_elo_upper: 1485,
  arena_elo_lower: 1475,
  arena_votes: 10000,
  price_in_per_m: 25,
  price_out_per_m: 100,
  context_length: 200000,
  arena_org: "OrgC",
};
const spd = (toks: number): Speed => ({ toks, latency: null, n: 1, rc: 100 });

describe("resolvedCmps", () => {
  it("null resolves to the top-2 pre-seed by rank", () => {
    expect(resolvedCmps(null, [beta, base])).toEqual(["orga/alpha", "orgb/beta"]);
  });
  it("an emptied roster stays empty; a list is as-is, capped at CMP_MAX", () => {
    expect(resolvedCmps([], [beta, base])).toEqual([]);
    expect(resolvedCmps(["x", "y"], [base])).toEqual(["x", "y"]);
    expect(resolvedCmps(["1", "2", "3", "4", "5"], []).length).toBe(CMP_MAX);
  });
});

describe("band", () => {
  it("chunks into rows of at most size", () => {
    expect(band([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(band([1, 2, 3, 4, 5], 4)).toEqual([[1, 2, 3, 4], [5]]);
    expect(band([1, 2], 4)).toEqual([[1, 2]]);
    expect(band([], 4)).toEqual([]);
  });
});

describe("buildMarks (pairwise)", () => {
  const m = () => buildMarks([base, beta], [null, null]);

  it("price rows: strict winner green, the other side orange", () => {
    expect(m()["orgb/beta"].price_in).toBe("win");
    expect(m()["orga/alpha"].price_in).toBe("lose");
    expect(m()["orgb/beta"].price_out).toBe("win");
    expect(m()["orga/alpha"].price_out).toBe("lose");
  });

  it("elo ties blue on CI overlap, green on a clear leader", () => {
    expect(m()["orga/alpha"].elo).toBe("tie");
    expect(m()["orgb/beta"].elo).toBe("tie");
    const hi: Row = { ...base, arena_elo_upper: 1501, arena_elo_lower: 1499 };
    const lo: Row = { ...beta, arena_elo: 1490, arena_elo_upper: 1491, arena_elo_lower: 1489 };
    const clear = buildMarks([hi, lo], [null, null]);
    expect(clear["orga/alpha"].elo).toBe("win");
    expect(clear["orgb/beta"].elo).toBe("lose");
  });

  it("null CIs fall back to the elo point", () => {
    const a: Row = { ...base, arena_elo_upper: null, arena_elo_lower: null };
    const b: Row = { ...beta, arena_elo: 1490, arena_elo_upper: null, arena_elo_lower: null };
    const marks = buildMarks([a, b], [null, null]);
    expect(marks["orga/alpha"].elo).toBe("win");
    expect(marks["orgb/beta"].elo).toBe("lose");
  });

  it("speed marks only when the p50s exist; higher wins", () => {
    const marks = buildMarks([base, beta], [spd(40), spd(47.2)]);
    expect(marks["orgb/beta"].speed).toBe("win");
    expect(marks["orga/alpha"].speed).toBe("lose");
    expect(buildMarks([base, beta], [null, null])["orga/alpha"].speed).toBeUndefined();
  });

  it("context ties on equal windows; votes follow the counts", () => {
    expect(m()["orga/alpha"].context).toBe("tie");
    expect(m()["orgb/beta"].context).toBe("tie");
    expect(m()["orgb/beta"].votes).toBe("win");
    expect(m()["orga/alpha"].votes).toBe("lose");
  });

  it("vision marks the capable side only when the set differs", () => {
    expect(m()["orgb/beta"].vision).toBe("win");
    expect(m()["orga/alpha"].vision).toBeUndefined();
    const allV = buildMarks([{ ...base, vision: true }, { ...beta, vision: true }], [null, null]);
    expect(allV["orgb/beta"].vision).toBeUndefined();
  });

  it("a single column gets no marks", () => {
    expect(buildMarks([base], [null])).toEqual({});
  });
});

describe("buildMarks (multi)", () => {
  it("co-leaders tie at the top, the rest lose", () => {
    const dup: Row = { ...beta, or_id: "orgd/dup", or_name: "OrgD: Dup" };
    const marks = buildMarks([base, beta, dup], [null, null, null]);
    expect(marks["orgb/beta"].price_in).toBe("tie");
    expect(marks["orgd/dup"].price_in).toBe("tie");
    expect(marks["orga/alpha"].price_in).toBe("lose");
  });

  it("N-way: the top CI cluster ties, outside models lose", () => {
    const marks = buildMarks([base, beta, gamma], [spd(40), spd(47.2), spd(30)]);
    expect(marks["orga/alpha"].elo).toBe("tie");
    expect(marks["orgb/beta"].elo).toBe("tie");
    expect(marks["orgc/gamma"].elo).toBe("lose");
    expect(marks["orga/alpha"].context).toBe("tie");
    expect(marks["orgb/beta"].context).toBe("tie");
    expect(marks["orgc/gamma"].context).toBe("lose");
    expect(marks["orgb/beta"].votes).toBe("win");
    expect(marks["orgc/gamma"].votes).toBe("lose");
    expect(marks["orgb/beta"].speed).toBe("win");
    expect(marks["orga/alpha"].speed).toBe("lose");
    expect(marks["orgc/gamma"].speed).toBe("lose");
    expect(marks["orgb/beta"].vision).toBe("win");
  });
});