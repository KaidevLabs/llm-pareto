import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import Details from "./Details.svelte";
import { ui } from "../lib/state.svelte";
import { store } from "../lib/endpoints.svelte";
import { data } from "../lib/data.svelte";
import type { EndpointsMap, Row } from "../lib/types";

// Synthetic fixtures (never real page snapshots — the python suite's
// fail-fast owns schema drift). Carried over from the 021 B18 round-2
// sketch runs.
const DEMO = {
  or_id: "z-ai/glm-5", or_name: "GLM-5", arena_org: "Z.AI", arena_license: "MIT",
  vision: true, arena_rank: 12, arena_elo: 1401.2, arena_elo_upper: 1407.1,
  arena_votes: 24190, price_in_per_m: 0.6, price_out_per_m: 1.0,
  context_length: 200000, arena_variants: ["0414", "air"],
  match_method: "exact", match_ratio: null,
} as Row;

const EPTS: EndpointsMap = {
  "z-ai/glm-5": [
    { provider: "GMICloud", tag: "fp4", pricing: { prompt: "0.0000003", completion: "0.0000006" }, quantization: "fp4", context_length: 200000, uptime_last_1d: 97.8, stats: null },
    { provider: "Z.AI", tag: "standard", pricing: { prompt: "0.0000006", completion: "0.000001" }, quantization: "fp8", context_length: 200000, uptime_last_1d: 99.2, stats: { p50_throughput: 81, p75_throughput: 95, p90_throughput: 120, p95_throughput: 140, p99_throughput: 180, p50_latency: 940, p75_latency: 1100, p90_latency: 1500, p95_latency: 2000, p99_latency: 3000, request_count: 1200, window_minutes: 30 } },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(EPTS) })
  ));
  data.rows = [DEMO];
});
// The endpoints fetch is a module-level cached promise: it settles once per
// test file. Tests that need other store outcomes set store fields directly
// (the cache never re-runs), so the error-path tests stay last.
afterEach(() => {
  cleanup();
  ui.families.clear();
  ui.search = "";
  ui.selected = null;
  ui.cmps = [];
  data.rows = [];
  vi.unstubAllGlobals();
});

describe("Details", () => {
  it("renders the model head + arena row with CI", async () => {
    render(Details, { props: { d: DEMO } });
    expect(screen.getByText("GLM-5")).toBeTruthy();
    expect(
      screen.getByText(
        (_, el) => !!el?.classList.contains("v") && /#12 · elo 1401\.2 \(±6\) · 24k votes/.test(el.textContent)
      )
    ).toBeTruthy();
  });

  it("sorts providers by $/M in ascending by default, with the ctx column", async () => {
    render(Details, { props: { d: DEMO } });
    await screen.findByText("GMICloud");
    const cells = screen.getAllByText(/^(GMICloud|Z\.AI)$/);
    expect(cells[0].textContent).toContain("GMICloud");
    expect(cells[1].textContent).toContain("Z.AI");
    expect(document.querySelector("table.epts thead")!.textContent).toContain("ctx");
  });

  it("marks the endpoint matching the chart price, with the basis note", async () => {
    render(Details, { props: { d: DEMO } });
    await screen.findByText("Z.AI");
    const marked = document.querySelector("tr.pmarked .pl div");
    expect(marked!.textContent).toContain("Z.AI");
    expect(screen.getByText(/chart price — the endpoint/)).toBeTruthy();
    expect(screen.getByText(/across 1 endpoint \(rc≥30\) · 1200 requests · 30-min window/)).toBeTruthy();
  });

  it("re-sorts from the delegated header click (tok/s)", async () => {
    render(Details, { props: { d: DEMO } });
    await screen.findByText("GMICloud");
    const spd = document.querySelector('th[data-sort="spd"]')!;
    await fireEvent.click(spd);
    const cells = screen.getAllByText(/^(GMICloud|Z\.AI)$/);
    expect(cells[0].textContent).toContain("Z.AI");
    expect(cells[1].textContent).toContain("GMICloud");
  });

  it("renders & literally (svelte escapes; no double-escaping)", async () => {
    render(Details, { props: { d: { ...DEMO, or_name: "A & B Models" } } });
    await screen.findByText("A & B Models");
    expect(screen.queryByText("A &amp; B Models")).toBe(null);
  });

  it("shows the filtered-out banner when the current filters hide the row", async () => {
    ui.families.add("OpenAI|GPT");
    render(Details, { props: { d: DEMO } });
    await screen.findByText(/⚠ filtered out/);
  });

  it("marks manual overrides gold in the match row and notes", async () => {
    render(Details, {
      props: { d: { ...DEMO, match_method: "override", match_ratio: null } },
    });
    await screen.findByText(/manual override/);
    const gold = document.querySelector(".drow .v.gold")!;
    expect(gold.textContent).toContain("manual override");
    const notes = Array.from(document.querySelectorAll(".dnote.gold"));
    expect(notes.map((n) => n.textContent)).toContain(
      "chart price is final — provider prices are reference"
    );
  });

  it("shows the tolerated 404 state (data null, no error)", async () => {
    store.data = null;
    store.error = null;
    store.done = true;
    render(Details, { props: { d: DEMO } });
    const note = await screen.findByText("provider data unavailable");
    expect(note.textContent).not.toContain("(");
  });

  it("shows the error path with the reason", async () => {
    store.data = null;
    store.error = "HTTP 500";
    store.done = true;
    render(Details, { props: { d: DEMO } });
    await screen.findByText("provider data unavailable (HTTP 500)");
  });

  it("the compare fast-access appends the model and closes the drawer", async () => {
    const r1 = { ...DEMO, or_id: "orga/alpha", or_name: "Alpha", arena_rank: 1 } as Row;
    const r2 = { ...DEMO, or_id: "orgb/beta", or_name: "Beta", arena_rank: 2 } as Row;
    data.rows = [DEMO, r1, r2]; // DEMO (rank 12) is not in the top-2 pre-seed
    ui.selected = DEMO;
    render(Details, { props: { d: DEMO } });
    await fireEvent.click(screen.getByRole("button", { name: "◈ compare" }));
    expect(ui.cmps).toEqual(["orga/alpha", "orgb/beta", "z-ai/glm-5"]);
    expect(ui.selected).toBe(null);
  });

  it("compare is a no-op for a model already picked", async () => {
    ui.cmps = ["z-ai/glm-5"];
    render(Details, { props: { d: DEMO } });
    await fireEvent.click(screen.getByRole("button", { name: "◈ compare" }));
    expect(ui.cmps).toEqual(["z-ai/glm-5"]);
  });

  it("compare is a no-op when the section is full", async () => {
    ui.cmps = ["a", "b", "c", "d"];
    render(Details, { props: { d: DEMO } });
    await fireEvent.click(screen.getByRole("button", { name: "◈ compare" }));
    expect(ui.cmps).toEqual(["a", "b", "c", "d"]);
  });
});
