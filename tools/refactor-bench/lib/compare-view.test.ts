import { describe, it, expect } from "vitest";
import { pickPair, staticRows, coverageRows, loadRows, interactRows } from "../../../public/bench/compare-view.mjs";

// Fixtures: hand-written, minimal — never real page snapshots (AGENTS.md).
// The tested module IS the shipped one (033 step 3): public/bench/compare-view.mjs.

type Row = {
  label: string;
  a: number | null;
  b: number | null;
  delta: number | null;
  dir: "lower" | "higher";
  dec: number;
  suffix: string;
  kind: "better" | "worse" | "same" | null;
};

const rowOf = (rows: Row[], label: string): Row => {
  const r = rows.find((x) => x.label === label);
  if (!r) throw new Error(`no row labelled ${label}`);
  return r;
};

const entry = (id: string, label = id) => ({ id, label, date: "2026-09-19T00:00:00.000Z", side: "new", files: [] });
const reg = [entry("run-a", "aaa1111"), entry("run-b", "bbb2222"), entry("run-c", "ccc3333 (dirty)")];

describe("pickPair", () => {
  it("defaults to the last two registry entries", () => {
    expect(pickPair("", reg)).toEqual({ a: reg[1], b: reg[2] });
  });
  it("loads an explicit pair from ?a=&b=", () => {
    expect(pickPair("?a=run-a&b=run-c", reg)).toEqual({ a: reg[0], b: reg[2] });
  });
  it("keeps the query's side order (a is the baseline)", () => {
    expect(pickPair("?a=run-c&b=run-b", reg)).toEqual({ a: reg[2], b: reg[1] });
  });
  it("treats empty a/b values as absent", () => {
    expect(pickPair("?a=&b=", reg)).toEqual({ a: reg[1], b: reg[2] });
  });
  it("errors on an unknown id, naming it", () => {
    expect(pickPair("?a=run-a&b=run-nope", reg).error).toContain("run-nope");
    expect(pickPair("?a=run-nope&b=run-b", reg).error).toContain("run-nope");
  });
  it("errors when only one side of the pair is given", () => {
    expect(pickPair("?a=run-a", reg).error).toContain("?b=");
    expect(pickPair("?b=run-b", reg).error).toContain("?a=");
  });
  it("errors when the registry holds fewer than two entries", () => {
    expect(pickPair("", [entry("run-a")]).error).toMatch(/two/);
  });
});

const staticA = {
  complexity: { fileCount: 10, lines: 100, functions: 20, cyclomatic: 80, maxFunction: 12, anyCount: 5 },
  duplication: { percent: 5.5 },
};
const staticB = {
  complexity: { fileCount: 12, lines: 130, functions: 24, cyclomatic: 90, maxFunction: 9, anyCount: 5 },
  duplication: { percent: 4.257 },
};

describe("staticRows", () => {
  const rows = staticRows(staticA, staticB) as Row[];
  it("lists the seven static metrics in report order", () => {
    expect(rows.map((r) => r.label)).toEqual([
      "files (app)",
      "lines (app)",
      "functions",
      "Σ cyclomatic",
      "max fn cyclomatic",
      "`any` count",
      "duplication %",
    ]);
  });
  it("reads B − A into delta", () => {
    expect(rowOf(rows, "files (app)")).toMatchObject({ a: 10, b: 12, delta: 2 });
    expect(rowOf(rows, "Σ cyclomatic")).toMatchObject({ a: 80, b: 90, delta: 10 });
    expect(rowOf(rows, "max fn cyclomatic")).toMatchObject({ a: 12, b: 9, delta: -3 });
  });
  it("marks a smaller metric better and a bigger one worse", () => {
    expect(rowOf(rows, "lines (app)").kind).toBe("worse");
    expect(rowOf(rows, "max fn cyclomatic").kind).toBe("better");
  });
  it("marks an unchanged metric same", () => {
    expect(rowOf(rows, "`any` count")).toMatchObject({ delta: 0, kind: "same" });
  });
  it("carries duplication as a two-decimal row", () => {
    expect(rowOf(rows, "duplication %")).toMatchObject({ dec: 2, kind: "better" });
    expect(rowOf(rows, "duplication %").delta).toBeCloseTo(-1.243, 5);
  });
  it("yields null delta and kind when a side is missing", () => {
    expect(rowOf(staticRows(staticA, null) as Row[], "lines (app)")).toMatchObject({
      a: 100,
      b: null,
      delta: null,
      kind: null,
    });
  });
});

const coverageA = { lines: 90.1, branches: 80, functions: 85, files: 20 };
const coverageB = { lines: 95.81, branches: 84.47, functions: 93.27, files: 22 };

describe("coverageRows", () => {
  const rows = coverageRows(coverageA, coverageB) as Row[];
  it("lists lines, branches, functions and files covered", () => {
    expect(rows.map((r) => r.label)).toEqual(["lines", "branches", "functions", "files covered"]);
  });
  it("reports percentages with two decimals and a % suffix", () => {
    expect(rowOf(rows, "lines")).toMatchObject({ a: 90.1, b: 95.81, dec: 2, suffix: "%" });
    expect(rowOf(rows, "lines").delta).toBeCloseTo(5.71, 5);
    expect(rowOf(rows, "files covered")).toMatchObject({ dec: 0, suffix: "" });
  });
  it("marks rising coverage better (higher-is-better polarity)", () => {
    expect(rowOf(rows, "lines").kind).toBe("better");
    expect(rowOf(rows, "branches").kind).toBe("better");
  });
  it("yields nulls for a run that reported no coverage", () => {
    const r = rowOf(coverageRows({ label: "x", null: true, note: "no tests" }, coverageB) as Row[], "functions");
    expect(r).toMatchObject({ a: null, b: 93.27, delta: null, kind: null });
  });
});

type LoadGroup = { condition: string; rows: Row[] };

const loadA = {
  conditions: {
    "cold-unthrottled": { chartMs: { median: 200 }, loadMs: { median: 500 }, transferKB: { median: 600 } },
    "warm-throttled": { chartMs: { median: 900 }, loadMs: { median: 1200 }, transferKB: { median: 40 } },
  },
};
const loadB = {
  conditions: {
    "cold-unthrottled": { chartMs: { median: 180 }, loadMs: { median: 520 }, transferKB: { median: 580 } },
    "warm-throttled": { chartMs: { median: 950 }, loadMs: { median: 1150 }, transferKB: { median: 0 } },
  },
};

describe("loadRows", () => {
  const groups = loadRows(loadA, loadB) as LoadGroup[];
  it("groups by condition in the harness's condition order", () => {
    expect(groups.map((g) => g.condition)).toEqual(["cold-unthrottled", "warm-throttled"]);
  });
  it("diffs chart-paint, load and transfer KB per condition", () => {
    const g = groups[0];
    expect(g.rows.map((r) => r.label)).toEqual(["chart-paint", "load", "transfer KB"]);
    expect(rowOf(g.rows, "chart-paint")).toMatchObject({ a: 200, b: 180, delta: -20, kind: "better" });
    expect(rowOf(g.rows, "load")).toMatchObject({ a: 500, b: 520, delta: 20, kind: "worse" });
    expect(rowOf(g.rows, "transfer KB")).toMatchObject({ a: 600, b: 580, delta: -20 });
  });
  it("includes a condition measured on one side only, null on the other", () => {
    const only = loadRows(
      { conditions: { "warm-throttled": { chartMs: { median: 900 } } } },
      { conditions: { "cold-throttled": { chartMs: { median: 3000 } } } },
    ) as LoadGroup[];
    expect(only.map((g) => g.condition)).toEqual(["cold-throttled", "warm-throttled"]);
    expect(rowOf(only[0].rows, "chart-paint")).toMatchObject({ a: null, b: 3000, delta: null, kind: null });
  });
});

const interactA = {
  initPaintMs: { median: 400 },
  zoomSettleMs: { median: 800 },
  drawerOpenMs: null,
  cold3DMs: { median: 250 },
  steady3DMs: { median: 200 },
  jankCount: { median: 2 },
  memDeltaKB: { median: -4000 },
};
const interactB = {
  initPaintMs: { median: 420 },
  zoomSettleMs: { median: 750 },
  drawerOpenMs: { median: 90 },
  cold3DMs: { median: 250 },
  steady3DMs: { median: 230 },
  jankCount: { median: 5 },
  memDeltaKB: { median: -3000 },
};

describe("interactRows", () => {
  const rows = interactRows(interactA, interactB) as Row[];
  it("lists the compared interactions in report order", () => {
    expect(rows.map((r) => r.label)).toEqual([
      "init→paint (ms)",
      "zoom settle (ms)",
      "threshold drag settle (ms)",
      "drawer open (ms)",
      "3D cold (ms)",
      "3D steady (ms)",
      "jank count",
      "heap Δ (KB)",
    ]);
  });
  it("diffs medians, lower-is-better", () => {
    expect(rowOf(rows, "init→paint (ms)")).toMatchObject({ a: 400, b: 420, delta: 20, kind: "worse" });
    expect(rowOf(rows, "zoom settle (ms)")).toMatchObject({ a: 800, b: 750, delta: -50, kind: "better" });
    expect(rowOf(rows, "jank count")).toMatchObject({ a: 2, b: 5, delta: 3, kind: "worse" });
  });
  it("marks an unchanged metric same", () => {
    expect(rowOf(rows, "3D cold (ms)")).toMatchObject({ delta: 0, kind: "same" });
  });
  it("yields null delta when a median is null on one side", () => {
    expect(rowOf(rows, "drawer open (ms)")).toMatchObject({ a: null, b: 90, delta: null, kind: null });
  });
  it("treats a less-negative heap delta as worse", () => {
    expect(rowOf(rows, "heap Δ (KB)")).toMatchObject({ a: -4000, b: -3000, delta: 1000, kind: "worse" });
  });
});