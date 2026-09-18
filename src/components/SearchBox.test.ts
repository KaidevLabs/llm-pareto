import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import SearchBox from "./SearchBox.svelte";
import { ui } from "../lib/state.svelte";
import { data } from "../lib/data.svelte";
import { buildOrgColors } from "../lib/colors";
import type { Row } from "../lib/types";

const row = (or_name: string, arena_org: string): Row =>
  ({ or_name, arena_org, or_id: arena_org.toLowerCase() + "/x" }) as Row;

beforeEach(() => {
  data.rows = [row("Alpha: Foo Bar", "Alpha"), row("Alpha: Foo Baz", "Alpha")];
  data.orgColor = buildOrgColors(data.rows);
});
afterEach(() => {
  cleanup();
  data.rows = [];
  data.orgColor = {};
  ui.search = "";
});

describe("SearchBox", () => {
  it("stores the query lowercased and shows the n/N count", async () => {
    render(SearchBox);
    const input = screen.getByPlaceholderText("Search models…");
    await fireEvent.input(input, { target: { value: "BAZ" } });
    expect(ui.search).toBe("baz");
    expect(screen.getByText("1/2")).toBeTruthy();
  });

  it("hides the count while the query is empty", async () => {
    render(SearchBox);
    expect(screen.queryByText(/\/2/)).toBe(null);
  });
});
