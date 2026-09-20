import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import ThresholdCtl from "./ThresholdCtl.svelte";
import { ui } from "../lib/state.svelte";
import { data } from "../lib/data.svelte";
import { store as eps } from "../lib/endpoints.svelte";
import type { Row, EndpointsMap, EndpointStats } from "../lib/types";

// Fixture extents (characterization, pinned from the component's math):
// blended at ratio 3 → cheap 1.5, dear 15 → price domain [0.75, 30]
// (lo/2, hi*2). t=500 on the log slider → 0.75*40^0.5 = 4.74. Elo domain
// [1200, 1400] → t=500 → 1300. Speed domain [50, 200] → t=500 → 125.
const cheap: Row = {
  or_id: "orga/x",
  or_name: "OrgA: X",
  price_in_per_m: 1,
  price_out_per_m: 3,
  arena_elo: 1200,
} as Row;
const dear: Row = {
  or_id: "orgb/y",
  or_name: "OrgB: Y",
  price_in_per_m: 10,
  price_out_per_m: 30,
  arena_elo: 1400,
} as Row;
const EPS: EndpointsMap = {
  "orga/x": [{ provider: "p", stats: { p50_throughput: 100, p50_latency: 200, request_count: 50 } as EndpointStats }],
};

const NO_THR = {
  priceMin: null, priceMax: null,
  eloMin: null, eloMax: null,
  speedMin: null, speedMax: null,
};

beforeEach(() => {
  data.rows = [cheap, dear];
  data.loaded = true;
  ui.mode = "general";
  ui.ratio = 3;
  ui.thr = { ...NO_THR };
});
afterEach(() => {
  cleanup();
  data.rows = [];
  data.loaded = false;
  eps.data = null;
  eps.done = false;
  ui.mode = "general";
  ui.ratio = 3;
  ui.thr = { ...NO_THR };
});

describe("ThresholdCtl", () => {
  it("numeric readouts are empty while unbounded", () => {
    render(ThresholdCtl);
    const nums = document.querySelectorAll(".thr .num") as NodeListOf<HTMLInputElement>;
    expect([...nums].map((n) => n.value)).toEqual(["", "", "", "", "", ""]);
  });

  it("price handles map the log domain to the blended extent", async () => {
    render(ThresholdCtl);
    await fireEvent.input(screen.getByLabelText("minimum price"), { target: { value: "500" } });
    expect(ui.thr.priceMin).toBe(4.74);
    await fireEvent.input(screen.getByLabelText("maximum price"), { target: { value: "500" } });
    expect(ui.thr.priceMax).toBe(4.74);
  });

  it("parking a handle at its unbounded end clears the bound", async () => {
    render(ThresholdCtl);
    const mx = screen.getByLabelText("maximum price");
    await fireEvent.input(mx, { target: { value: "500" } });
    expect(ui.thr.priceMax).toBe(4.74);
    await fireEvent.input(mx, { target: { value: "1000" } });
    expect(ui.thr.priceMax).toBe(null);
    const mn = screen.getByLabelText("minimum arena elo");
    await fireEvent.input(mn, { target: { value: "500" } });
    expect(ui.thr.eloMin).toBe(1300);
    await fireEvent.input(mn, { target: { value: "0" } });
    expect(ui.thr.eloMin).toBe(null);
  });

  it("the two handles of a line clamp, never cross (price)", async () => {
    render(ThresholdCtl);
    // max pinned at 5 via its numeric field
    await fireEvent.change(screen.getByLabelText("maximum price value"), { target: { value: "5" } });
    expect(ui.thr.priceMax).toBe(5);
    // dragging min past the max handle stops AT it (same point, not past)
    await fireEvent.input(screen.getByLabelText("minimum price"), { target: { value: "1000" } });
    expect(ui.thr.priceMin).toBe(4.99);
    // and the numeric fields clamp toward each other, never past
    await fireEvent.change(screen.getByLabelText("minimum price value"), { target: { value: "10" } });
    expect(ui.thr.priceMin).toBe(5);
    await fireEvent.change(screen.getByLabelText("maximum price value"), { target: { value: "5" } });
    expect(ui.thr.priceMax).toBe(5);
  });

  it("the elo pair clamps too", async () => {
    render(ThresholdCtl);
    await fireEvent.change(screen.getByLabelText("minimum arena elo value"), { target: { value: "1300" } });
    await fireEvent.change(screen.getByLabelText("maximum arena elo value"), { target: { value: "1250" } });
    expect(ui.thr.eloMax).toBe(1300);
  });

  it("speed row stays disabled until the endpoints fetch settles", () => {
    render(ThresholdCtl);
    expect((screen.getByLabelText("minimum output speed") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("maximum output speed value") as HTMLInputElement).disabled).toBe(true);
  });

  it("speed handles map linearly once endpoints arrive", async () => {
    eps.data = EPS;
    eps.done = true;
    render(ThresholdCtl);
    const s = screen.getByLabelText("minimum output speed") as HTMLInputElement;
    expect(s.disabled).toBe(false);
    await fireEvent.input(s, { target: { value: "500" } });
    expect(ui.thr.speedMin).toBe(125);
  });

  it("price row disables in the speed view (D2: no price axis)", () => {
    ui.mode = "speed";
    render(ThresholdCtl);
    expect((screen.getByLabelText("minimum price") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("maximum price") as HTMLInputElement).disabled).toBe(true);
  });

  it("numeric fields accept typed values and clear on empty/garbage", async () => {
    render(ThresholdCtl);
    const min = screen.getByLabelText("minimum price value");
    // below the domain floor clamps up to lo (0.75)
    await fireEvent.change(min, { target: { value: "0.5" } });
    expect(ui.thr.priceMin).toBe(0.75);
    await fireEvent.change(min, { target: { value: "" } });
    expect(ui.thr.priceMin).toBe(null);
    await fireEvent.change(min, { target: { value: "abc" } });
    expect(ui.thr.priceMin).toBe(null);
    await fireEvent.change(min, { target: { value: "2.5" } });
    expect(ui.thr.priceMin).toBe(2.5);
  });

  it("reset clears every bound and starts disabled", async () => {
    render(ThresholdCtl);
    const btn = screen.getByLabelText("clear all thresholds") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await fireEvent.input(screen.getByLabelText("minimum price"), { target: { value: "500" } });
    await fireEvent.input(screen.getByLabelText("minimum arena elo"), { target: { value: "500" } });
    expect(btn.disabled).toBe(false);
    await fireEvent.click(btn);
    expect(ui.thr).toEqual(NO_THR);
    const nums = document.querySelectorAll(".thr .num") as NodeListOf<HTMLInputElement>;
    expect([...nums].map((n) => n.value)).toEqual(["", "", "", "", "", ""]);
  });
});
