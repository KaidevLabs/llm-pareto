import { describe, it, expect } from "vitest";
import { paretoFrontier, paretoFrontier3D, fitLinear, fitLog, fitDecade } from "./pareto";

const p = (value: number[], n: string) => ({ value, n });
const names = (ps: { n: string }[]) => ps.map((x) => x.n);

// Characterization: values pinned from the real app.js functions
// (harness run 2026-09-18, plan 028 step 1).
describe("paretoFrontier", () => {
  it("keeps the non-dominated points, sorted by price", () => {
    const low = [p([1, 100], "A"), p([2, 90], "B"), p([3, 80], "C"), p([1.5, 80], "D")];
    expect(names(paretoFrontier(low))).toEqual(["A"]);
  });
  it("a same-price lower-elo point is dominated", () => {
    expect(names(paretoFrontier([p([1, 100], "E"), p([1, 90], "F")]))).toEqual(["E"]);
  });
  it("exact duplicate points both survive", () => {
    expect(names(paretoFrontier([p([1, 100], "E"), p([1, 100], "E2")]))).toEqual(["E", "E2"]);
  });
  it("highX flips the semantics for the speed view", () => {
    expect(names(paretoFrontier([p([100, 80], "X"), p([50, 80], "Y")], true))).toEqual(["X"]);
  });
});

describe("paretoFrontier3D", () => {
  it("keeps the 3-objective non-dominated surface, Elo-ordered", () => {
    const pts = [
      p([0.5, 2.0, 100], "A"), p([1, 2.5, 90], "B"), p([0.6, 2.2, 105], "C"),
      p([1.2, 2.1, 95], "D"), p([2, 2.0, 80], "E"), p([1.5, 2.2, 90], "G"),
    ];
    expect(names(paretoFrontier3D(pts))).toEqual(["B", "A", "C"]);
  });
});

describe("fitLinear", () => {
  it("pads and snaps to the 25 grid", () => {
    expect(fitLinear([100, 200])).toEqual({ min: 75, max: 225 });
    expect(fitLinear([1000, 2000])).toEqual({ min: 950, max: 2050 });
    expect(fitLinear([])).toBe(null);
  });
});

describe("fitLog", () => {
  it("pads in log space, ignores non-positive values", () => {
    const b = fitLog([1, 100])!;
    expect(b.min).toBeCloseTo(0.6309573444801932, 12);
    expect(b.max).toBeCloseTo(158.48931924611142, 12);
    expect(fitLog([0])).toBe(null);
    expect(fitLog([])).toBe(null);
  });
});

describe("fitDecade", () => {
  it("snaps already-log10 values to whole decades", () => {
    expect(fitDecade([0.5, 2.5])).toEqual({ min: 0, max: 3 });
    expect(fitDecade([Math.log10(0.5), Math.log10(300)])).toEqual({ min: -1, max: 3 });
  });
});
