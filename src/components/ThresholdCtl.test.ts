import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import ThresholdCtl from "./ThresholdCtl.svelte";
import { ui } from "../lib/state.svelte";
import { data } from "../lib/data.svelte";
import { store as eps } from "../lib/endpoints.svelte";
import type { Row, EndpointsMap, EndpointStats } from "../lib/types";

// Fixture extents (characterization, pinned from the component's math):
// blended at ratio 3 → cheap 1.5, dear 15 → price domain [0.75, 30]
// (lo/2, hi*2). t=500 on the log slider → 0.75*40^0.5 = 4.74.
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

const NO_THR = { priceMin: null, priceMax: null, eloMin: null, speedMin: null };

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
  it("readouts show — while unbounded", () => {
    render(ThresholdCtl);
    const vals = document.querySelectorAll(".thr .val");
    expect([...vals].map((v) => v.textContent)).toEqual(["—", "—", "—", "…"]);
  });

  it("price min slider maps the log domain to the blended extent", async () => {
    render(ThresholdCtl);
    await fireEvent.input(screen.getByLabelText("minimum price"), { target: { value: "500" } });
    expect(ui.thr.priceMin).toBe(4.74);
    expect(screen.getByText("$4.74")).toBeTruthy();
  });

  it("price max slider parks at T → unbounded, mid → bounded", async () => {
    render(ThresholdCtl);
    const s = screen.getByLabelText("maximum price");
    await fireEvent.input(s, { target: { value: "500" } });
    expect(ui.thr.priceMax).toBe(4.74);
    await fireEvent.input(s, { target: { value: "1000" } });
    expect(ui.thr.priceMax).toBe(null);
  });

  it("elo min slider is linear over the elo extent", async () => {
    render(ThresholdCtl);
    await fireEvent.input(screen.getByLabelText("minimum arena elo"), { target: { value: "500" } });
    expect(ui.thr.eloMin).toBe(1300);
    expect(screen.getByText("1300")).toBeTruthy();
  });

  it("speed slider stays disabled until the endpoints fetch settles", () => {
    render(ThresholdCtl);
    expect((screen.getByLabelText("minimum output speed") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("…")).toBeTruthy();
  });

  it("speed min slider maps linearly once endpoints arrive", async () => {
    eps.data = EPS;
    eps.done = true;
    render(ThresholdCtl);
    const s = screen.getByLabelText("minimum output speed") as HTMLInputElement;
    expect(s.disabled).toBe(false);
    await fireEvent.input(s, { target: { value: "500" } });
    expect(ui.thr.speedMin).toBe(125);
  });

  it("price rows disable in the speed view (D2: no price axis)", () => {
    ui.mode = "speed";
    render(ThresholdCtl);
    expect((screen.getByLabelText("minimum price") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getAllByText("n/a").length).toBe(2);
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
    const vals = document.querySelectorAll(".thr .val");
    expect([...vals].map((v) => v.textContent)).toEqual(["—", "—", "—", "…"]);
  });
});
