import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Row } from "./types";
import type { SnapIndexEntry, Snapshot } from "./snapshots.svelte";

// Fixtures: a 3-frame history (hand-typed — the python suite's fail-fast
// owns the real index.json / snapshot schema). The frames share two models
// whose elo climbs, so a frame's identity is observable in its rows.

const TS = [
  "2026-10-01T00:00:00Z",
  "2026-10-01T06:00:00Z",
  "2026-10-01T12:00:00Z",
];

const INDEX: SnapIndexEntry[] = TS.map((ts, i) => ({
  ts,
  file: `20261001T0${i}0000Z.json`,
  combined: 154,
  unmatched_arena: 0,
  unmatched_openrouter: 0,
  speed: true,
}));

function row(orId: string, elo: number): Row {
  return {
    or_id: orId,
    or_name: orId,
    price_in_per_m: 1,
    price_out_per_m: 2,
    vision: false,
    context_length: null,
    arena_rank: 1,
    arena_elo: elo,
    arena_elo_upper: null,
    arena_elo_lower: null,
    arena_votes: null,
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

function buildSnap(i: number): Snapshot {
  return {
    ts: TS[i],
    rows: [row("org/a", 1500 + i * 10), row("org/b", 1400 + i * 10)],
    meta: {
      fetched_at: TS[i],
      join: {
        combined: 154,
        unmatched_arena: 0,
        unmatched_openrouter: 0,
        by_method: { exact: 2 },
      },
    },
    speed: i === 0 ? { "org/a": { p50_throughput: 55, request_count: 1200 } } : {},
  };
}

// Stable instances (not a fresh object per call) — the identity assertions
// below verify the parsed payload passes through uncloned.
const SNAPS: Snapshot[] = TS.map((_, i) => buildSnap(i));

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notOk = (status: number) => ({ ok: false, status, json: async () => ({}) });

let fetchMock: ReturnType<typeof vi.fn>;

// The store's index promise, snapshot cache, and playback state are
// module-level — per-page-load by design (043 A3). Each test gets a fresh
// module instance so no test inherits another's cache or shown frame.
async function fresh() {
  vi.resetModules();
  const [mod, dataMod] = await Promise.all([
    import("./snapshots.svelte"),
    import("./data.svelte"),
  ]);
  return { ...mod, data: dataMod.data };
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
  vi.useRealTimers();
});

describe("loadSnapIndex", () => {
  it("fetches ./data/history/index.json and loads the entries", async () => {
    const m = await fresh();
    const entries = await m.loadSnapIndex();
    expect(entries).toEqual(INDEX);
    expect(m.snapIndex.entries).toEqual(INDEX);
    expect(m.snapIndex.loaded).toBe(true);
    expect(m.snapIndex.error).toBe(null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("./data/history/index.json");
  });

  it("is a cached promise — a second call never re-fetches", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    await m.loadSnapIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("failure is soft: error recorded, empty entries, loaded", async () => {
    const m = await fresh();
    fetchMock.mockImplementation(async () => notOk(500));
    const entries = await m.loadSnapIndex();
    expect(entries).toEqual([]);
    expect(m.snapIndex.entries).toEqual([]);
    expect(m.snapIndex.error).toBe("HTTP 500");
    expect(m.snapIndex.loaded).toBe(true);
  });

  it("a 404 is a tolerated state, not an error", async () => {
    const m = await fresh();
    fetchMock.mockImplementation(async () => notOk(404));
    await m.loadSnapIndex();
    expect(m.snapIndex.entries).toEqual([]);
    expect(m.snapIndex.error).toBe(null);
    expect(m.snapIndex.loaded).toBe(true);
  });
});

describe("loadSnapshot", () => {
  it("fetches ./data/history/<file>, the ts resolved from the index", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    const snap = await m.loadSnapshot(TS[1]);
    expect(snap).toBe(SNAPS[1]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "./data/history/" + INDEX[1].file
    );
  });

  it("caches per ts: a revisited frame is fetched exactly once", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    await m.loadSnapshot(TS[0]);
    const again = await m.loadSnapshot(TS[0]);
    expect(again).toBe(SNAPS[0]);
    const url = "./data/history/" + INDEX[0].file;
    expect(
      fetchMock.mock.calls.filter((c) => c[0] === url).length
    ).toBe(1);
  });

  it("rejects an unknown ts — no index entry to resolve a file", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    await expect(m.loadSnapshot("1999-01-01T00:00:00Z")).rejects.toThrow(
      "unknown ts"
    );
  });
});

describe("showFrame", () => {
  it("loads the frame and makes it current: active, i, frameRows = its rows", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    m.data.rows = [row("live/now", 999)];
    await m.showFrame(1);
    expect(m.playback.active).toBe(true);
    expect(m.playback.i).toBe(1);
    // deep, not identity: the $state proxies on the way out — the content
    // (frame 1's rows, not the live rows set above) is the contract
    expect(m.frameRows()).toStrictEqual(SNAPS[1].rows);
  });

  it("a failed load rejects and leaves the state untouched", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    fetchMock.mockImplementation(async (url: string) =>
      url === "./data/history/index.json" ? ok(INDEX) : notOk(500)
    );
    await expect(m.showFrame(1)).rejects.toThrow("HTTP 500");
    expect(m.playback.active).toBe(false);
    expect(m.playback.i).toBe(-1);
    expect(m.frameRows()).toStrictEqual(m.data.rows);
  });
});

describe("frameRows", () => {
  it("returns the live data.rows when no frame is active", async () => {
    const m = await fresh();
    const live = [row("live/now", 1)];
    m.data.rows = live;
    expect(m.frameRows()).toStrictEqual(live);
  });
});

describe("play / pause", () => {
  it("play from live: shows frame 0, prefetches frame 1 before the swap", async () => {
    const m = await fresh();
    vi.useFakeTimers();
    await m.loadSnapIndex();
    await m.play();
    expect(m.playback.active).toBe(true);
    expect(m.playback.playing).toBe(true);
    expect(m.playback.i).toBe(0);
    expect(m.frameRows()).toStrictEqual(SNAPS[0].rows);
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    // frame 1 is already warm in the cache while frame 0 is shown —
    // the next swap must not wait on a cold fetch
    expect(urls).toContain("./data/history/" + INDEX[1].file);
    // 043 step 03: the pinned domain loads the first + last frames at
    // entry, so with this 3-frame index the last frame (2) is fetched by
    // the pin, not the prefetch — every frame lands exactly once (shown
    // 0, prefetched 1, pinned 2), none twice.
    for (const e of INDEX) {
      expect(
        urls.filter((u) => u === "./data/history/" + e.file)
      ).toHaveLength(1);
    }
  });

  it("the ticker advances one frame per 500/fps ms", async () => {
    const m = await fresh();
    vi.useFakeTimers();
    await m.loadSnapIndex();
    await m.play();
    await vi.advanceTimersByTimeAsync(250); // fps 2 -> 250 ms per frame
    expect(m.playback.i).toBe(1);
    expect(m.frameRows()).toStrictEqual(SNAPS[1].rows);
    await vi.advanceTimersByTimeAsync(250);
    expect(m.playback.i).toBe(2);
  });

  it("stops at the last frame (no loop), staying on it", async () => {
    const m = await fresh();
    vi.useFakeTimers();
    await m.loadSnapIndex();
    await m.play();
    await vi.advanceTimersByTimeAsync(500); // frames 1 and 2
    expect(m.playback.i).toBe(2);
    expect(m.playback.playing).toBe(true);
    await vi.advanceTimersByTimeAsync(250); // the stop tick
    expect(m.playback.playing).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.playback.i).toBe(2);
    expect(m.playback.active).toBe(true);
  });

  it("play at the last frame restarts from frame 0", async () => {
    const m = await fresh();
    vi.useFakeTimers();
    await m.loadSnapIndex();
    await m.play();
    await vi.advanceTimersByTimeAsync(750); // at the last frame, stopped
    expect(m.playback.playing).toBe(false);
    await m.play();
    expect(m.playback.i).toBe(0);
    expect(m.playback.playing).toBe(true);
    expect(m.frameRows()).toStrictEqual(SNAPS[0].rows);
  });

  it("pause freezes the ticker on the current frame", async () => {
    const m = await fresh();
    vi.useFakeTimers();
    await m.loadSnapIndex();
    await m.play();
    await vi.advanceTimersByTimeAsync(250);
    expect(m.playback.i).toBe(1);
    m.pause();
    expect(m.playback.playing).toBe(false);
    expect(m.playback.active).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.playback.i).toBe(1);
  });

  it("play is a no-op while playing (one ticker, one advance per tick)", async () => {
    const m = await fresh();
    vi.useFakeTimers();
    await m.loadSnapIndex();
    await m.play();
    await m.play();
    await vi.advanceTimersByTimeAsync(250);
    expect(m.playback.i).toBe(1);
    expect(m.playback.playing).toBe(true);
  });

  it("play with an empty index is a no-op", async () => {
    const m = await fresh();
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => notOk(404));
    await m.loadSnapIndex();
    await m.play();
    expect(m.playback.active).toBe(false);
    expect(m.playback.playing).toBe(false);
    expect(m.frameRows()).toStrictEqual(m.data.rows);
  });
});

describe("exit", () => {
  it("returns to live: not active, not playing, the live rows", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    await m.showFrame(2);
    m.exit();
    expect(m.playback.active).toBe(false);
    expect(m.playback.playing).toBe(false);
    expect(m.frameRows()).toStrictEqual(m.data.rows);
    // the cache survives: the frame is a fetch-free revisit
    const url = "./data/history/" + INDEX[2].file;
    expect(await m.loadSnapshot(TS[2])).toBe(SNAPS[2]);
    expect(fetchMock.mock.calls.filter((c) => c[0] === url)).toHaveLength(1);
  });

  it("stops a running playback (the ticker is gone)", async () => {
    const m = await fresh();
    vi.useFakeTimers();
    await m.loadSnapIndex();
    await m.play();
    await vi.advanceTimersByTimeAsync(250);
    expect(m.playback.i).toBe(1);
    m.exit();
    expect(m.playback.playing).toBe(false);
    expect(m.playback.active).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.playback.i).toBe(-1);
  });
});

describe("speedAt", () => {
  it("returns the shown frame's trimmed speed for a model", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    await m.showFrame(0);
    expect(m.speedAt("org/a")).toEqual({
      p50_throughput: 55,
      request_count: 1200,
    });
  });

  it("is null for a model the frame's map lacks (backfill's empty map)", async () => {
    const m = await fresh();
    await m.loadSnapIndex();
    await m.showFrame(1); // speed: {}
    expect(m.speedAt("org/a")).toBe(null);
  });

  it("is null when no frame is active", async () => {
    const m = await fresh();
    expect(m.speedAt("org/a")).toBe(null);
  });
});
