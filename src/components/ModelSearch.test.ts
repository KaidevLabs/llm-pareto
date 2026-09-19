import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import ModelSearch from "./ModelSearch.svelte";
import { data } from "../lib/data.svelte";
import { ui } from "../lib/state.svelte";
import type { Row } from "../lib/types";

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
const beta: Row = { ...base, or_id: "orgb/beta", or_name: "OrgB: Beta", arena_rank: 2, arena_org: "OrgB" };
const gamma: Row = { ...base, or_id: "orgc/gamma", or_name: "OrgC: Gamma", arena_rank: 3, arena_org: "OrgC" };

afterEach(() => {
  cleanup();
  data.rows = [];
  ui.cmps = [];
});

const activeText = () =>
  document.querySelector(".ms li button.active")?.textContent ?? null;

describe("ModelSearch keyboard", () => {
  it("arrow down/up moves the highlight; enter picks the active one", async () => {
    data.rows = [base, beta, gamma];
    const onadd = vi.fn();
    render(ModelSearch, { props: { ids: [], onadd, onremove: vi.fn() } });
    const input = screen.getByLabelText("search models to compare");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "org" } });
    await screen.findByRole("button", { name: /OrgA: Alpha/ });
    expect(activeText()).toContain("OrgA: Alpha");
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(activeText()).toContain("OrgB: Beta");
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(activeText()).toContain("OrgC: Gamma");
    await fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(activeText()).toContain("OrgB: Beta");
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(onadd).toHaveBeenCalledTimes(1);
    expect(onadd.mock.calls[0][0].or_id).toBe("orgb/beta");
 expect((input as HTMLInputElement).value).toBe("");
  });

  it("the highlight clamps at the ends and arrows do not type in the input", async () => {
    data.rows = [base, beta];
    render(ModelSearch, { props: { ids: [], onadd: vi.fn(), onremove: vi.fn() } });
    const input = screen.getByLabelText("search models to compare");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "org" } });
    await screen.findByRole("button", { name: /OrgA: Alpha/ });
    await fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(activeText()).toContain("OrgA: Alpha");
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    await fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(activeText()).toContain("OrgB: Beta");
  });

  it("enter with no hits is a no-op; escape clears and closes", async () => {
    data.rows = [base, beta];
    const onadd = vi.fn();
    render(ModelSearch, { props: { ids: [], onadd, onremove: vi.fn() } });
    const input = screen.getByLabelText("search models to compare");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "zzz" } });
    await screen.findByText(/no models match/);
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(onadd).not.toHaveBeenCalled();
    await fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("");
    expect(document.querySelector(".ms ul")).toBe(null);
  });
});
