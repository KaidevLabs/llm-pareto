import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import Comparator from "./Comparator.svelte";
import { ui } from "../lib/state.svelte";
import { data } from "../lib/data.svelte";
import type { Row } from "../lib/types";

// Synthetic fixtures (never real page snapshots); the win/lose/tie colors
// pin the marks from the pure-logic suite (inline style:color values).
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

beforeEach(() => {
  data.rows = [base, beta, gamma];
});
afterEach(() => {
  cleanup();
  ui.cmps = [];
  data.rows = [];
});

const colOf = (text: string): string | null => {
  const el = [...document.querySelectorAll(".is-card .v span")].find(
    (s) => s.textContent === text
  );
  return el ? (el as HTMLElement).style.color : null;
};

describe("Comparator", () => {
  it("renders the top-2 pre-seed as cards, the rail, the add slot, and marks on the rows", () => {
    render(Comparator);
    expect(screen.getByText("OrgA: Alpha")).toBeTruthy();
    expect(screen.getByText("OrgB: Beta")).toBeTruthy();
    expect(document.querySelector(".verdicts")).toBe(null);
    // one shared rail labels the band; the cards carry no in-card labels
    expect([...document.querySelectorAll(".rail .rt")].map((t) => t.textContent)).toEqual([
      "arena",
      "openrouter $/m",
      "arena $/m (reported)",
      "speed",
      "context",
      "org",
    ]);
    expect(document.querySelectorAll(".is-card .drow .k").length).toBe(0);
    // the dashed add slot holds the search input; the rail sits last
    expect(document.querySelectorAll(".is-add").length).toBe(1);
    expect(screen.getByLabelText("search models to compare")).toBeTruthy();
    expect(
      [...document.querySelectorAll(".band > *")].at(0)!.classList.contains("rail")
    ).toBe(true);
    expect(
      [...document.querySelectorAll(".band > *")].at(-1)!.classList.contains("is-add")
    ).toBe(true);
    // the skeleton slot is two separated elements: the input as its title,
    // the shimmering card below
    expect(document.querySelector(".is-add .sk-title input")).toBeTruthy();
    expect(document.querySelector(".is-add .sk-card")).toBeTruthy();
    expect(document.querySelector(".is-add .sk-title .sk-card")).toBe(null);
    // price in: Beta wins (green), Alpha loses (orange)
    expect(colOf("$5.00")).toBe("var(--accent)");
    expect(colOf("$10")).toBe("var(--lose)");
    // elo: CIs overlap → both tie (blue)
    expect(colOf("1504.6 (±4)")).toBe("var(--tie)");
    expect(colOf("1500.0 (±5)")).toBe("var(--tie)");
    // votes: Beta wins; context: equal → tie; vision: only Beta's suffix marks
    expect(colOf("72k votes")).toBe("var(--accent)");
    expect(colOf("30k votes")).toBe("var(--lose)");
    expect(colOf("1000k")).toBe("var(--tie)");
    expect(colOf("· ✨ vision")).toBe("var(--accent)");
  });

  it("the cards carry no compare button (that fast-access lives on the drawer's card)", () => {
    render(Comparator);
    expect(screen.queryByRole("button", { name: /compare/ })).toBe(null);
  });

  it("aligned rows: every card shows the same value rows, gaps as -- (D2: no variants/match)", () => {
    // beta carries arena-reported prices + variants; base carries neither —
    // misaligned before the fix.
    data.rows = [beta, base];
    ui.cmps = ["orgb/beta", "orga/alpha"];
    render(Comparator);
    const seqs = [...document.querySelectorAll(".is-card")].map((col) =>
      [...col.querySelectorAll(".drow")].map((d) => d.children.length)
    );
    expect(seqs[0]).toEqual(seqs[1]);
    expect(seqs[0].length).toBe(6);
    // the row base lacks renders "--" in its column
    expect(
      [...document.querySelectorAll(".is-card")[1].querySelectorAll(".drow")].some((d) =>
        d.textContent!.includes("--")
      )
    ).toBe(true);
    expect(screen.queryByText(/variants/)).toBe(null);
    expect(screen.queryByText(/match/)).toBe(null);
  });

  it("a search pick appends and materializes the pre-seed", async () => {
    render(Comparator);
    const input = screen.getByLabelText("search models to compare");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "gamma" } });
    await fireEvent.click(await screen.findByRole("button", { name: /OrgC: Gamma/ }));
    expect(ui.cmps).toEqual(["orga/alpha", "orgb/beta", "orgc/gamma"]);
  });

  it("already-picked models are excluded from the suggestions", async () => {
    render(Comparator);
    const input = screen.getByLabelText("search models to compare");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "a" } });
    await screen.findByRole("button", { name: /OrgC: Gamma/ });
    expect(document.querySelectorAll(".ms li button").length).toBe(1);
  });

    it("the card × removes; backspace removes the last pick; empty restores the pre-seed", async () => {
    ui.cmps = ["orga/alpha", "orgb/beta", "orgc/gamma"];
    render(Comparator);
    await fireEvent.click(screen.getByRole("button", { name: "remove OrgC: Gamma" }));
    expect(ui.cmps).toEqual(["orga/alpha", "orgb/beta"]);
    await fireEvent.keyDown(screen.getByLabelText("search models to compare"), { key: "Backspace" });
    expect(ui.cmps).toEqual(["orga/alpha"]);
    await fireEvent.keyDown(screen.getByLabelText("search models to compare"), { key: "Backspace" });
    expect(ui.cmps).toEqual([]);
  });

  it("at the cap there is no add slot — removing one reveals it again", async () => {
    data.rows = [base, beta, gamma, { ...beta, or_id: "orgd/dup", or_name: "OrgD: Dup" }];
    ui.cmps = ["orga/alpha", "orgb/beta", "orgc/gamma", "orgd/dup"];
    render(Comparator);
    expect(document.querySelectorAll(".is-add").length).toBe(0);
    expect(screen.queryByLabelText("search models to compare")).toBe(null);
    await fireEvent.click(screen.getByRole("button", { name: "remove OrgD: Dup" }));
    expect(ui.cmps).toEqual(["orga/alpha", "orgb/beta", "orgc/gamma"]);
    expect(screen.getByLabelText("search models to compare")).toBeTruthy();
  });
});
