import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import OfPanel from "./OfPanel.svelte";
import { ui } from "../lib/state.svelte";
import { data } from "../lib/data.svelte";
import { buildOrgColors } from "../lib/colors";
import type { Row } from "../lib/types";

const row = (or_name: string, arena_org: string): Row =>
  ({ or_name, arena_org, or_id: arena_org.toLowerCase() + "/x" }) as Row;

const ROWS = [row("Alpha: Foo Bar", "Alpha"), row("Alpha: Foo Baz", "Alpha"), row("Beta: Foo Bar", "Beta")];

beforeEach(() => {
  data.rows = ROWS;
  data.orgColor = buildOrgColors(ROWS);
  ui.families.clear();
});
afterEach(() => {
  cleanup();
  data.rows = [];
  data.orgColor = {};
  ui.families.clear();
});

async function openPanel() {
  render(OfPanel);
  await fireEvent.click(screen.getByTitle(/Filter by organization/));
  return screen.getByPlaceholderText("Filter orgs & families…");
}

describe("OfPanel", () => {
  it("renders the org tree with counts, frequency-ordered", async () => {
    await openPanel();
    const names = Array.from(document.querySelectorAll(".oforg .ofname")).map((n) => n.textContent);
    expect(names).toEqual(["Alpha", "Beta"]);
    expect(document.querySelector(".ofcount")!.textContent).toBe("2");
  });

  it("toggles a family leaf and shows the badge count", async () => {
    await openPanel();
    await fireEvent.click(document.querySelector(".ofchev")!);
    await fireEvent.click(document.querySelector(".offam")!);
    expect(ui.families.has("Alpha|Foo Bar")).toBe(true);
    expect(document.querySelector(".ofbadge")!.textContent).toBe("1");
    await fireEvent.click(document.querySelector(".offam")!);
    expect(ui.families.has("Alpha|Foo Bar")).toBe(false);
    expect(document.querySelector(".ofbadge")!.textContent).toBe("");
  });

  it("org toggle applies union semantics over its families", async () => {
    await openPanel();
    await fireEvent.click(document.querySelector(".ofchev")!);
    await fireEvent.click(document.querySelector(".offam")!); // Alpha|Foo Bar on
    await fireEvent.click(document.querySelector(".oforg")!); // all on
    expect(ui.families.has("Alpha|Foo Bar")).toBe(true);
    expect(ui.families.has("Alpha|Foo Baz")).toBe(true);
    await fireEvent.click(document.querySelector(".oforg")!); // all off
    expect(ui.families.has("Alpha|Foo Bar")).toBe(false);
    expect(ui.families.has("Alpha|Foo Baz")).toBe(false);
    expect(document.querySelector(".oforg")!.className).not.toContain("part");
  });

  it("marks a partially-selected org with the part chip", async () => {
    await openPanel();
    await fireEvent.click(document.querySelector(".ofchev")!);
    await fireEvent.click(document.querySelector(".offam")!);
    const org = document.querySelector(".oforg")!;
    expect(org.className).toContain("part");
    expect(org.querySelector(".ofchip")!.textContent).toBe("part");
  });

  it("filters the tree by query (org rows with kid hits stay visible)", async () => {
    const input = await openPanel();
    await fireEvent.input(input, { target: { value: "Baz" } });
    const orgs = Array.from(document.querySelectorAll(".oforg"));
    expect(orgs[0].getAttribute("hidden")).toBe(null); // Alpha: kid hit
    expect(orgs[1].getAttribute("hidden")).toBe(""); // Beta: no org/kid hit
  });

  it("auto-expands and auto-collapses on query", async () => {
    const input = await openPanel();
    await fireEvent.click(document.querySelector(".ofchev")!);
    await fireEvent.input(input, { target: { value: "zzz-nothing" } });
    // no hits: kids close (kidHits 0), rows hidden
    expect(document.querySelector(".offams")!.className).toContain("hidden");
    await fireEvent.input(input, { target: { value: "Bar" } });
    // kid hits: Alpha's and Beta's families auto-open
    const trees = Array.from(document.querySelectorAll(".offams"));
    expect(trees[0]!.className).not.toContain("hidden");
  });

  it("escape clears the query first, then closes", async () => {
    const input = await openPanel();
    await fireEvent.input(input, { target: { value: "foo" } });
    input.focus();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("");
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByPlaceholderText("Filter orgs & families…")).toBe(null);
  });
});
