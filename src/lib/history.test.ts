import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ui } from "./state.svelte";
import { initHistory, applyFromURL } from "./history.svelte";

// applyFromURL's fallbacks ride urlstate's DEFAULTS/NO_THR — the single
// defaults owner (plan 039 step 5, 030 F11). These characterization tests
// pin the consolidated behavior: an empty URL resets every serialized
// field to the boot defaults, a non-default URL lands field-for-field. A
// future field whose default drifts between urlstate and the store shows
// up here.

function setURL(search: string): void {
  history.replaceState(null, "", "/" + search);
}

beforeEach(() => {
  // initHistory is once-per-module (seedFromURL guards); the first call
  // seeds from the clean URL installed here, satisfying applyFromURL's
  // initialized guard for the whole file
  setURL("");
  initHistory();
});

afterEach(() => {
  setURL("");
  applyFromURL();
});

describe("applyFromURL defaults (single owner: urlstate DEFAULTS/NO_THR)", () => {
  it("an empty URL resets every serialized field to the default", () => {
    ui.mode = "in";
    ui.vision = "vision";
    ui.ratio = 7;
    ui.spread = true;
    ui.frontier = false;
    ui.three3d = true;
    ui.search = "gpt";
    ui.thr.priceMax = 5;
    setURL("");
    applyFromURL();
    expect(ui.mode).toBe("general");
    expect(ui.vision).toBe("all");
    expect(ui.ratio).toBe(3);
    expect(ui.spread).toBe(false);
    expect(ui.frontier).toBe(true);
    expect(ui.three3d).toBe(false);
    expect(ui.search).toBe("");
    expect(ui.thr).toEqual({
      priceMin: null, priceMax: null, eloMin: null, eloMax: null, speedMin: null, speedMax: null,
    });
  });

  it("the reset thr is a fresh object, not the shared NO_THR", () => {
    setURL("");
    applyFromURL();
    ui.thr.priceMin = 5;
    setURL("");
    applyFromURL();
    expect(ui.thr.priceMin).toBe(null);
  });

  it("a non-default URL applies field-for-field", () => {
    setURL("?view=speed&q=gpt&ratio=7&spread=1&frontier=0&vis=vision&fam=OpenAI|GPT&pmax=20&smin=40");
    applyFromURL();
    expect(ui.mode).toBe("speed");
    expect(ui.vision).toBe("vision");
    expect(ui.ratio).toBe(7);
    expect(ui.spread).toBe(true);
    expect(ui.frontier).toBe(false);
    expect(ui.three3d).toBe(false);
    expect(ui.search).toBe("gpt");
    expect([...ui.families]).toEqual(["OpenAI|GPT"]);
    expect(ui.thr).toEqual({
      priceMin: null, priceMax: 20, eloMin: null, eloMax: null, speedMin: 40, speedMax: null,
    });
  });
});
