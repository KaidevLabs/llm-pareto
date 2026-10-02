import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Row } from "./types";
import type { SnapIndexEntry, Snapshot } from "./snapshots.svelte";
import { frameDiff, computeTrails, type Trail } from "./trails";

// Fixtures: a 4-frame history (hand-typed, synthetic — the python suite's
// fail-fast owns the real index.json / snapshot schema). Per-frame rosters
// are supplied by each test so entry/exit behavior is observable.

const TS = [
  "2026-10-01T00:00:00Z",
  "2026-10-01T06:00:00Z",
  "2026-10-01T12:00:00Z",
  "2026-10-01T18:00:00Z",
];

const INDEX: SnapIndexEntry[] = TS.map((ts, i) => ({
  ts,
  file: `20261001T${i}0000Z.json`,
  combined: 154,
  unmatched_arena: 0,
  unmatched_openrouter: 0,
  speed: true,
}));

function row(
  orId: string,
  elo: number,
  votes: number | null = null,
  rank = 1
): Row {
  return {
    or_id: orId,
    or_name: orId,
    price_in_per_m: 1,
    price_out_per_m: 2,
    vision: false,
    context_length: null,
    arena_rank: rank,
    arena_elo: elo,
    arena_elo_upper: null,
    arena_elo_lower: null,
    arena_votes: votes,
    arena_org: "Org",
    arena_license: null,
    arena_model: null,
    arena_model_url: null,
    arena_variants: [],
    arena_context_length: null,
    arena_price_in_per_m: null,
    arena_price_out_per_m: null,
    match_method: "exact",
    match_ratio: null,
  };
}

function snap(ts: string, rows: Row[]): Snapshot {
  return {
    ts,
    rows,
    meta: {
      fetched_at: ts,
      join: {
        combined: 154,
        unmatched_arena: 0,
        unmatched_openrouter: 0,
        by_method: { exact: rows.length },
      },
    },
    speed: {},
  };
}

// a climbs through every frame; b exits after frame 1; c enters at frame 2;
// d is only ever in the last frame.
const ROSTERS: Row[][] = [
  [row("org/a", 1500), row("org/b", 1400)],
  [row("org/a", 1510), row("org/b", 1410)],
  [row("org/a", 1520), row("org/c", 1600)],
  [row("org/a", 1530), row("org/c", 1610), row("org/d", 1700)],
];

const SNAPS: Snapshot[] = TS.map((ts, i) => snap(ts, ROSTERS[i]));

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notOk = (status: number) => ({ ok: false, status, json: async () => ({}) });

let fetchMock: ReturnType<typeof vi.fn>;

// The store's index promise, snapshot cache, and playback state are
// module-level — per-page-load by design (043 A3). Each test gets a fresh
// module instance so no test inherits another's cache or shown frame.
async function fresh() {
  vi.resetModules();
  const [trails, snapMod, dataMod] = await Promise.all([
    import("./trails"),
    import("./snapshots.svelte"),
    import("./data.svelte"),
  ]);
  return {
    ...snapMod,
    ...trails,
    data: dataMod.data,
  };
}

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url === "./data/history/index.json") return ok(INDEX);
    const i = INDEX.findIndex((e) => "./data/history/" + e.file === url);
    return i >= 0 ? ok(SNAPS[i]) : notOk(404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Store = Awaited<ReturnType<typeof fresh>>;

async function prime(m: Store, upto: number) {
  await m.loadSnapIndex();
  for (let i = 0; i <= upto; i++) await m.loadSnapshot(TS[i]);
  await m.showFrame(upto);
}

describe("computeTrails", () => {
  it("trails each model present in ≥2 cached frames, ordered from its entry frame", async () => {
    const m = await fresh();
    await prime(m, 3);
    const trails = m.computeTrails(3, 25);
    expect(trails.map((t: Trail) => t.orId)).toEqual(["org/a", "org/c"]);
    // a: four frames; c: from its entry frame 2 on (mid-play entry)
    expect(trails[0].rows.map((r) => r.arena_elo)).toEqual([1500, 1510, 1520, 1530]);
    expect(trails[1].rows.map((r) => r.arena_elo)).toEqual([1600, 1610]);
  });

  it("a model's trail terminates at its last frame (exit)", async () => {
    const m = await fresh();
    await prime(m, 3);
    const trails = m.computeTrails(3, 25);
    // b exited after frame 1 — no trail (only frames 0..1, and its last
    // shown-frame absence already keeps it out of the top-N candidates)
    expect(trails.find((t: Trail) => t.orId === "org/b")).toBeUndefined();
  });

  it("a single-frame presence yields nothing", async () => {
    const m = await fresh();
    await prime(m, 3);
    expect(
      m.computeTrails(3, 25).find((t: Trail) => t.orId === "org/d")
    ).toBeUndefined();
  });

  it("caps at top-N by arena_votes of the current frame; keep overrides the cap", async () => {
    const m = await fresh();
    // frame 3 carries votes: c wins the cap, a is mid, d is low (and
    // single-frame — it can never trail); frame 3's file serves the custom
    // snapshot (the shared fixture is never mutated — tests run in order)
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "./data/history/index.json") return ok(INDEX);
      if (url === "./data/history/" + INDEX[3].file)
        return ok(
          snap(TS[3], [
            row("org/a", 1530, 10),
            row("org/c", 1610, 100),
            row("org/d", 1700, 5),
          ])
        );
      const i = INDEX.findIndex((e) => "./data/history/" + e.file === url);
      return i >= 0 ? ok(SNAPS[i]) : notOk(404);
    });
    await m.loadSnapIndex();
    for (const i of [0, 1, 2, 3]) await m.loadSnapshot(TS[i]);
    await m.showFrame(3);
    // top-1 = c (100 votes); a (10) is capped out
    expect(m.computeTrails(3, 1).map((t: Trail) => t.orId)).toEqual(["org/c"]);
    // the keep set rides above the cap: a is kept, d still drops (single frame)
    const t = m.computeTrails(3, 1, new Set(["org/a", "org/d"]));
    expect(t.map((x: Trail) => x.orId)).toEqual(["org/a", "org/c"]);
  });

  it("null votes sort behind voted rows by the fallback arena rank", async () => {
    const m = await fresh();
    // frame 3's roster: a voted (5), v2 and w null — v2 rank 1 ahead of w
    // rank 2. v2 also sits in frame 2 so its trail exists; w is
    // single-frame, so the cap's null-ordering is observable through which
    // trails exist at all.
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "./data/history/index.json") return ok(INDEX);
      if (url === "./data/history/" + INDEX[2].file)
        return ok(snap(TS[2], [row("org/a", 1520), row("org/v2", 1600)]));
      if (url === "./data/history/" + INDEX[3].file)
        return ok(
          snap(TS[3], [
            row("org/a", 1530, 5),
            row("org/v2", 1610, null, 1),
            row("org/w", 1700, null, 2),
          ])
        );
      const i = INDEX.findIndex((e) => "./data/history/" + e.file === url);
      return i >= 0 ? ok(SNAPS[i]) : notOk(404);
    });
    await m.loadSnapIndex();
    await m.loadSnapshot(TS[0]);
    // frame 2: a + v2 (v2's two-frame base); frame 1 deliberately uncached
    await m.loadSnapshot(TS[2]);
    await m.showFrame(3);
    // top-2 = a (voted) then v2 (nulls, better rank) — w is capped out and
    // single-frame besides
    const t = m.computeTrails(3, 2);
    expect(t.map((x: Trail) => x.orId)).toEqual(["org/a", "org/v2"]);
    expect(t.find((x: Trail) => x.orId === "org/w")).toBeUndefined();
  });

  it("keep-set ids always trail regardless of N", async () => {
    const m = await fresh();
    await prime(m, 3);
    const trails = m.computeTrails(3, 1, new Set(["org/c"]));
    // top-1 of the current frame is org/a (rank fallback — all votes null);
    // the keep set adds org/c
    expect(trails.map((t: Trail) => t.orId)).toEqual(["org/a", "org/c"]);
  });

  it("an uncached frame contributes nothing — the trail reads through the gap", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    fetchMock.mockImplementation(async (url: string) =>
      url === "./data/history/index.json" || url === "./data/history/" + INDEX[1].file
        ? url === "./data/history/" + INDEX[1].file
          ? notOk(500)
          : ok(INDEX)
        : INDEX.findIndex((e) => "./data/history/" + e.file === url) >= 0
        ? ok(SNAPS[INDEX.findIndex((e) => "./data/history/" + e.file === url)])
        : notOk(404)
    );
    for (const i of [0, 2, 3]) await m.loadSnapshot(TS[i]);
    await m.showFrame(3);
    const trails = m.computeTrails(3, 25);
    // a: frames 0, 2, 3 — the failed frame 1 is skipped, not blocking
    expect(trails[0].rows.map((r) => r.arena_elo)).toEqual([1500, 1520, 1530]);
    // b: only in frames 0..1 and frame 1 never landed — a single cached
    // frame, no trail
    expect(trails.find((t: Trail) => t.orId === "org/b")).toBeUndefined();
  });

  it("returns nothing past the index length or before the first frame", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    await m.loadSnapshot(TS[0]);
    expect(m.computeTrails(-1, 25)).toEqual([]);
    expect(m.computeTrails(99, 25)).toEqual([]);
  });

  it("carries each frame's own speed per trail point, null where absent (B2 fallback)", async () => {
    const m = await fresh();
    // frames 0..2 with a speed map; frame 2 carries no speed entry for
    // org/a (its row is there, its speed isn't), frame 0 has both
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "./data/history/index.json") return ok(INDEX);
      if (url.endsWith(INDEX[0].file))
        return ok({
          ...SNAPS[0],
          speed: { "org/a": { p50_throughput: 55, request_count: 1200 } },
        });
      if (url.endsWith(INDEX[2].file))
        return ok(
          snap(TS[2], [row("org/a", 1520), row("org/b", 1620)])
        );
      const i = INDEX.findIndex((e) => "./data/history/" + e.file === url);
      return i >= 0 ? ok(SNAPS[i]) : notOk(404);
    });
    await m.loadSnapIndex();
    await m.loadSnapshot(TS[0]);
    await m.loadSnapshot(TS[2]);
    await m.showFrame(2);
    const t = m.computeTrails(2, 25).find((x: Trail) => x.orId === "org/a");
    // speeds parallel to rows, "as-of each run": frame 0's value, frame 2's
    // null (the render falls back to the live map for it — B14/B2)
    expect(t?.speeds).toEqual([55, null]);
  });
});

describe("frameDiff", () => {
  it("reports entered and exited by or_id", () => {
    const prev = [row("org/a", 1500), row("org/b", 1400)];
    const cur = [row("org/a", 1520), row("org/c", 1600)];
    expect(frameDiff(prev, cur)).toEqual({
      entered: [cur[1]],
      exited: [prev[1]],
    });
  });

  it("reports nothing for identical frames (a filter-only re-render)", () => {
    const rows = [row("org/a", 1500)];
    expect(frameDiff(rows, [...rows])).toEqual({ entered: [], exited: [] });
  });
});
