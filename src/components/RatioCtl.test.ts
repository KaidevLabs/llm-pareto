import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import RatioCtl from "./RatioCtl.svelte";
import { ui } from "../lib/state.svelte";

beforeEach(() => {
  ui.mode = "general";
  ui.ratio = 3;
  ui.spread = false;
});
afterEach(() => {
  cleanup();
  ui.mode = "general";
  ui.ratio = 3;
  ui.spread = false;
});

describe("RatioCtl", () => {
  it("shows the ratio and updates it from the slider", async () => {
    render(RatioCtl);
    expect(screen.getByText("3:1")).toBeTruthy();
    const slider = screen.getByLabelText(/input to output token ratio/);
    await fireEvent.input(slider, { target: { value: "7" } });
    expect(ui.ratio).toBe(7);
    expect(screen.getByText("7:1")).toBeTruthy();
  });

  it("toggles the spread pill", async () => {
    render(RatioCtl);
    await fireEvent.click(screen.getByTitle(/spread bars/));
    expect(ui.spread).toBe(true);
  });

  it("hides outside the general mode", () => {
    ui.mode = "speed";
    render(RatioCtl);
    const box = document.querySelector(".ratio")!;
    expect(box.className).toContain("hidden");
  });
});
