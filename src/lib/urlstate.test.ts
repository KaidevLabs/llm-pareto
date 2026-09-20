import { describe, it, expect } from "vitest";
import { read, write, parseQuery } from "./urlstate";
import type { Mode } from "./state.svelte";

describe("read", () => {
  it("empty search -> empty patch", () => {
    expect(read("")).toEqual({});
    expect(read("?")).toEqual({});
  });

  it("view=3d sets three3d, 2D views set mode", () => {
    expect(read("?view=3d").three3d).toBe(true);
    expect(read("?view=in").mode).toBe("in");
    expect(read("?view=speed").mode).toBe("speed");
  });

  it("unknown values are ignored", () => {
    expect(read("?view=banana")).toEqual({});
    expect(read("?vis=colorblind")).toEqual({});
    expect(read("?ratio=abc")).toEqual({});
    expect(read("?spread=yes")).toEqual({});
    expect(read("?frontier=off")).toEqual({});
    expect(read("?fam=OpenAI")).toEqual({});
    expect(read("?nonsense=1")).toEqual({});
  });

  it("tour is not state: read drops it (entry action, App's boot concern)", () => {
    expect(read("?view=3d&tour=1")).toEqual({ three3d: true });
  });

  it("ratio must be a finite number in [0,10]", () => {
    expect(read("?ratio=7").ratio).toBe(7);
    expect(read("?ratio=-1").ratio).toBeUndefined();
    expect(read("?ratio=11").ratio).toBeUndefined();
  });

  it("fam keeps only pipe leaves", () => {
    expect(read("?fam=OpenAI|GPT,Anthropic|Claude").families).toEqual([
      "OpenAI|GPT",
      "Anthropic|Claude",
    ]);
  });

  it("thr reads pmin/pmax/emin/emax/smin/smax, absent keys fall to null", () => {
    expect(read("?pmin=5&pmax=20&emin=1300&emax=1500&smin=40&smax=200").thr).toEqual({
      priceMin: 5, priceMax: 20, eloMin: 1300, eloMax: 1500, speedMin: 40, speedMax: 200,
    });
    expect(read("?pmin=5").thr).toEqual({
      priceMin: 5, priceMax: null, eloMin: null, eloMax: null, speedMin: null, speedMax: null,
    });
  });

  it("invalid threshold values drop; no valid ones -> no thr key", () => {
    expect(read("?pmin=abc&pmax=-1")).toEqual({});
    expect(read("?smin=NaN")).toEqual({});
    expect(read("?emin=x&smin=40").thr).toEqual({
      priceMin: null, priceMax: null, eloMin: null, eloMax: null, speedMin: 40, speedMax: null,
    });
  });

  it("full combo", () => {
    expect(read("?view=3d&q=claude&vis=vision&ratio=8.5&spread=1&frontier=0&fam=OpenAI|GPT")).toEqual({
      three3d: true,
      search: "claude",
      vision: "vision",
      ratio: 8.5,
      spread: true,
      frontier: false,
      families: ["OpenAI|GPT"],
    });
  });
});

describe("write", () => {
  const base = {
    mode: "general" as Mode,
    three3d: false,
    vision: "all" as "all" | "vision",
    ratio: 3,
    spread: false,
    frontier: true,
    search: "",
    families: [] as string[],
    thr: { priceMin: null, priceMax: null, eloMin: null, eloMax: null, speedMin: null, speedMax: null } as const,
  };

  it("defaults -> empty string (bare URL stays canonical)", () => {
    expect(write(base)).toBe("");
  });

  it("non-defaults serialize", () => {
    expect(write({ ...base, three3d: true })).toBe("view=3d");
    expect(write({ ...base, mode: "in" })).toBe("view=in");
    expect(write({ ...base, vision: "vision" })).toBe("vis=vision");
    expect(write({ ...base, search: "gpt" })).toBe("q=gpt");
    expect(write({ ...base, ratio: 7 })).toBe("ratio=7");
    expect(write({ ...base, spread: true })).toBe("spread=1");
    expect(write({ ...base, frontier: false })).toBe("frontier=0");
  });

  it("ratio is rounded to 1dp", () => {
    expect(write({ ...base, ratio: 3.333333 })).toBe("ratio=3.3");
  });

  it("thr bounds serialize rounded to 2dp, nulls omitted", () => {
    expect(write({ ...base, thr: { priceMin: 3.14159, priceMax: null, eloMin: 1300.5, eloMax: 1500.25, speedMin: null, speedMax: 88.125 } })).toBe(
      "pmin=3.14&emin=1300.5&emax=1500.25&smax=88.13",
    );
  });

  it("families join with commas", () => {
    const fams = ["OpenAI|GPT", "x|y"];
    expect(write({ ...base, families: fams })).toBe("fam=OpenAI%7CGPT%2Cx%7Cy");
    expect(parseQuery("?" + write({ ...base, families: fams })).fam).toBe("OpenAI|GPT,x|y");
  });

  it("spaces encode as +", () => {
    expect(write({ ...base, search: "gpt 5" })).toBe("q=gpt+5");
    expect(parseQuery("?" + write({ ...base, search: "gpt 5" })).q).toBe("gpt 5");
  });
});

describe("round-trip", () => {
  it("read(write(state)) preserves every serialized key", () => {
    const s = {
      mode: "out" as Mode,
      three3d: false,
      vision: "vision" as "all" | "vision",
      ratio: 6.5,
      spread: true,
      frontier: false,
      search: "gemini",
      families: ["a|b", "c|d"],
      thr: { priceMin: 0.5, priceMax: 99.9, eloMin: 1200, eloMax: 1500, speedMin: 25.5, speedMax: 180 },
    };
    const back = read("?" + write(s));
    expect(back).toEqual({
      mode: "out",
      vision: "vision",
      ratio: 6.5,
      spread: true,
      frontier: false,
      search: "gemini",
      families: ["a|b", "c|d"],
      thr: { priceMin: 0.5, priceMax: 99.9, eloMin: 1200, eloMax: 1500, speedMin: 25.5, speedMax: 180 },
    });
  });

  it("3d folds over mode", () => {
    const back = read("?" + write({ ...{ mode: "speed" as Mode, three3d: true }, vision: "all", ratio: 3, spread: false, frontier: true, search: "", families: [] as string[] }));
    expect(back.three3d).toBe(true);
    expect(back.mode).toBeUndefined();
  });
});
