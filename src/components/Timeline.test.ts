import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/svelte";
import type { Row } from "../lib/types";
import type { SnapIndexEntry, Snapshot } from "../lib/snapshots.svelte";

// Fixtures: a 4-frame history spanning a month boundary (a September
// frame and an October frame, so the sparse tick rule has a mark to lay
// down) — hand-typed, synthetic; the python suite's fail-fast owns the
// real index.json / snapshot schema. Per-frame rows carry a distinct elo
// so a frame's identity is observable in frameRows().

const TS = [
  "2026-09-01T00:00:00Z",
  "2026-09-15T00:00:00Z",
  "2026-10-01T00:00:00Z",
  "2026-10-15T00:00:00Z",
];

const INDEX: SnapIndexEntry[] = TS.map((ts, i) => ({
  ts,
  file: `frame-${i}.json`,
  combined: 154 + i,
  unmatched_arena: 1,
  unmatched_openrouter: 2 + i,
  speed: false,
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
        combined: 154 + i,
        unmatched_arena: 1,
        unmatched_openrouter: 2 + i,
        by_method: { exact: 2 },
      },
    },
    speed: {},
  };
}

const SNAPS: Snapshot[] = TS.map((_, i) => buildSnap(i));

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notOk = (status: number) => ({ ok: false, status, json: async () => ({}) });

let fetchMock: ReturnType<typeof vi.fn>;

// The store's index promise, snapshot cache, and playback state are
// module-level — per-page-load by design (043 A3). Each test gets a fresh
// module graph so no test inherits another's cache, frame, or pin.
// vi.resetModules also resets the svelte runtime itself, so `render`
// (and `cleanup` — its mounted-instance registry is module state) must
// come from the SAME fresh graph (a component mounted by a stale
// runtime's testing-library throws effect_orphan, and a stale cleanup
// never unmounts it). The store-only suites never hit this: they render
// no components.
let tl: typeof import("@testing-library/svelte") | null = null;

async function fresh() {
  vi.resetModules();
  const [comp, mod, dataMod, lib] = await Promise.all([
    import("./Timeline.svelte"),
    import("../lib/snapshots.svelte"),
    import("../lib/data.svelte"),
    import("@testing-library/svelte"),
  ]);
  tl = lib;
  return { ...mod, data: dataMod.data, render: lib.render, Timeline: comp.default };
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
  tl?.cleanup();
  tl = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Timeline", () => {
  it("renders nothing until the index loads, then the dock chrome", async () => {
    const m = await fresh();
    m.render(m.Timeline);
    expect(document.querySelector(".timeline")).toBeNull();
    await m.loadSnapIndex();
    await waitFor(() =>
      expect(document.querySelector(".timeline")).toBeTruthy()
    );
    // the transport row
    expect(screen.getByText(/play/i)).toBeTruthy();
    expect(screen.getByText("2×")).toBeTruthy();
    // the scrubber: slider + the sparse ticks (first day+time, the month
    // boundary mark, last day+time)
    expect(
      screen.getByLabelText("snapshot position")
    ).toBeTruthy();
    expect(screen.getByText("Sep 1 00:00")).toBeTruthy();
    expect(screen.getByText("Oct")).toBeTruthy();
    expect(screen.getByText("Oct 15 00:00")).toBeTruthy();
    // the live readout (no frame active)
    expect(screen.getByText(/4 snapshots/)).toBeTruthy();
  });

  it("the slider reflects playback.i — the newest frame while live, the shown frame in time mode", async () => {
    const m = await fresh();
    m.render(m.Timeline);
    await m.loadSnapIndex();
    const slider = await waitFor(() =>
      screen.getByLabelText("snapshot position")
    );
    // live: parked at the newest frame
    expect((slider as HTMLInputElement).value).toBe("3");
    await m.enterTime(1);
    await waitFor(() =>
      expect((slider as HTMLInputElement).value).toBe("1")
    );
  });

  it("a slider drag pauses a running playback and shows the frame", async () => {
    const m = await fresh();
    vi.useFakeTimers();
    m.render(m.Timeline);
    await m.loadSnapIndex();
    await waitFor(() => screen.getByLabelText("snapshot position"));
    await m.play();
    expect(m.playback.playing).toBe(true);
    expect(m.playback.i).toBe(0);
    const slider = screen.getByLabelText("snapshot position");
    fireEvent.input(slider, { target: { value: "2" } });
    expect(m.playback.playing).toBe(false);
    await vi.advanceTimersByTimeAsync(0); // the frame load is in flight
    expect(m.playback.i).toBe(2);
    expect(m.frameRows()).toStrictEqual(SNAPS[2].rows);
    await waitFor(() =>
      expect((slider as HTMLInputElement).value).toBe("2")
    );
  });

  it("the play/pause button toggles the ticker", async () => {
    const m = await fresh();
    vi.useFakeTimers();
    m.render(m.Timeline);
    await m.loadSnapIndex();
    await waitFor(() => screen.getByText(/play/i));
    fireEvent.click(screen.getByText(/play/i));
    await vi.advanceTimersByTimeAsync(0); // play() awaits the frame loads
    expect(m.playback.playing).toBe(true);
    expect(m.playback.i).toBe(0);
    await fireEvent.click(screen.getByText(/pause/i));
    expect(m.playback.playing).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.playback.i).toBe(0);
  });

  it("the frame-rate button cycles 0.5× / 1× / 2×", async () => {
    const m = await fresh();
    m.render(m.Timeline);
    await m.loadSnapIndex();
    await waitFor(() => screen.getByText("2×"));
    expect(m.playback.fps).toBe(2);
    await fireEvent.click(screen.getByText("2×"));
    expect(m.playback.fps).toBe(0.5);
    await fireEvent.click(screen.getByText("0.5×"));
    expect(m.playback.fps).toBe(1);
    await fireEvent.click(screen.getByText("1×"));
    expect(m.playback.fps).toBe(2);
  });

  it("the live-exit button returns to live: the data.rows rendering", async () => {
    const m = await fresh();
    m.render(m.Timeline);
    const live = [row("live/now", 777)];
    m.data.rows = live;
    await m.loadSnapIndex();
    await waitFor(() => screen.getByLabelText("snapshot position"));
    await m.enterTime(2);
    expect(m.playback.active).toBe(true);
    expect(m.frameRows()).toStrictEqual(SNAPS[2].rows);
    const liveBtn = await waitFor(() =>
      screen.getByTitle("Back to the live data")
    );
    await fireEvent.click(liveBtn);
    expect(m.playback.active).toBe(false);
    expect(m.playback.playing).toBe(false);
    expect(m.playback.i).toBe(-1);
    expect(m.frameRows()).toStrictEqual(live);
    await waitFor(() =>
      expect(
        (screen.getByLabelText("snapshot position") as HTMLInputElement).value
      ).toBe("3")
    );
  });

  it("the readout shows the frame's ts and join counts from its meta", async () => {
    const m = await fresh();
    m.render(m.Timeline);
    await m.loadSnapIndex();
    await waitFor(() => screen.getByText(/4 snapshots/));
    await m.enterTime(2);
    await waitFor(() => screen.getByText(/2026-10-01 00:00 UTC/));
    const readout = screen.getByText(/unmatched/);
    expect(readout.textContent).toContain("156 joined");
    expect(readout.textContent).toContain("5 unmatched"); // 1 arena + 4 OpenRouter
  });

  it("the readout shows the +E / −E delta against the previous frame", async () => {
    const m = await fresh();
    // frame 3 gains a model (org/c enters) — the shared fixture is never
    // mutated; the override serves the extended roster and the pin caches it
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "./data/history/index.json") return ok(INDEX);
      if (url.endsWith("frame-3.json"))
        return ok({
          ...SNAPS[3],
          rows: [...SNAPS[3].rows, row("org/c", 1700)],
        });
      const i = INDEX.findIndex((e) => "./data/history/" + e.file === url);
      return i >= 0 ? ok(SNAPS[i]) : notOk(404);
    });
    m.render(m.Timeline);
    await m.loadSnapIndex();
    await waitFor(() => screen.getByText(/4 snapshots/));
    await m.enterTime(2);
    await waitFor(() => screen.getByText(/2026-10-01 00:00 UTC/));
    // the first shown frame has nothing to diff against — no delta line
    expect(screen.getByText(/unmatched/).textContent).not.toContain(
      "since previous"
    );
    await m.showFrame(3);
    await waitFor(() =>
      expect(screen.getByText(/unmatched/).textContent).toContain(
        "+1 / −0 since previous"
      )
    );
  });

  it("a fast scrub: a stale selection never lands after a newer one", async () => {
    const m = await fresh();
    m.render(m.Timeline);
    await m.loadSnapIndex();
    // Gate frame 2's fetch, scrub past it while it stalls, then release —
    // the older frame must be dropped (no backwards jump).
    let release2!: () => void;
    const gate = new Promise<void>((r) => (release2 = r));
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "./data/history/index.json") return ok(INDEX);
      if (url.endsWith("frame-2.json")) {
        await gate;
        return ok(SNAPS[2]);
      }
      const i = INDEX.findIndex((e) => "./data/history/" + e.file === url);
      return i >= 0 ? ok(SNAPS[i]) : notOk(404);
    });
    const stalled = m.enterTime(2); // pin resolves; the frame-2 load stalls
    await new Promise((r) => setTimeout(r, 5)); // let it reach the gate
    await m.enterTime(3);
    expect(m.playback.i).toBe(3);
    expect(m.frameRows()).toStrictEqual(SNAPS[3].rows);
    release2();
    await stalled;
    expect(m.playback.i).toBe(3);
    expect(m.frameRows()).toStrictEqual(SNAPS[3].rows);
  });
});
