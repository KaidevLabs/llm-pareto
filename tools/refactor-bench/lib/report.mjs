// 031 A4/report: merge results/*.json → markdown report (provenance, per-dimension
// tables with old/new/delta, shared-asset split, caveats). Side-aware: a `--single`
// run (only the new side measured) still renders. Reads from the run's outDir.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = (outDir) => (outDir ? outDir : join(here, "..", "results"));
const read = async (f, outDir) => JSON.parse(await (await import("node:fs/promises")).readFile(join(resultsDir(outDir), f), "utf8"));
const num = (x) => (x == null ? "—" : x);
const delta = (n, o) => (n == null || o == null || n === "—" || o === "—" ? "—" : (n - o === 0 ? "0" : (n - o > 0 ? "+" : "") + (n - o)));

const LOAD_METRICS = [
  ["ttfbMs", "TTFB"], ["dclMs", "DOMContentLoaded"], ["loadMs", "load"], ["fcpMs", "FCP"], ["lcpMs", "LCP"], ["chartMs", "chart-paint"], ["requests", "requests"], ["transferKB", "transfer KB"],
];
const INTERACT_METRICS = [
  ["initPaintMs", "init→paint (ms)"], ["zoomSettleMs", "zoom settle (ms)"], ["zoomEvents", "zoom events"], ["drawerOpenMs", "drawer open (ms)"], ["drawerCloseMs", "drawer close (ms)"], ["cold3DMs", "3D cold (ms)"], ["steady3DMs", "3D steady (ms)"], ["jankCount", "jank count"], ["jankTBTms", "jank TBT (ms)"], ["memLoadKB", "heap load (KB)"], ["memDeltaKB", "heap Δ (KB)"],
];
const CONDITIONS = ["cold-unthrottled", "warm-unthrottled", "cold-throttled", "warm-throttled"];

function table(headers, rows) {
  const w = headers.map((h, i) => {
    let m = h.length;
    for (const r of rows) m = Math.max(m, String(r[i]).length);
    return m;
  });
  const fmt = (r) => "| " + r.map((c, i) => String(c).padEnd(w[i])).join(" | ") + " |";
  const sep = "| " + w.map((n) => "-".repeat(n)).join(" | ") + " |";
  return [fmt(headers), sep, ...rows.map(fmt)].join("\n");
}

// rows: [{ label, old, neu, d? }]; renders columns per available sides.
function dimTable(rows, sides) {
  const headers = ["metric", ...sides.map((s) => (s === "old" ? "old" : "new")), ...(sides.length === 2 ? ["Δ"] : [])];
  const body = rows.map((r) => {
    const vals = sides.map((s) => ((s === "old" ? r.old : r.neu) == null ? "—" : (s === "old" ? r.old : r.neu)));
    return [r.label, ...vals, ...(sides.length === 2 ? [r.d != null ? r.d : "—"] : [])];
  });
  return table(headers, body);
}

function cyclomaticOffenders(s) {
  const sides = [];
  if (s.old) sides.push("old");
  if (s.new) sides.push("new");
  const worst = (key) => {
    const fns = s[key]?.complexity?.topFunctions ?? [];
    return fns[0] ?? null;
  };
  const chartsShare = (key) => {
    const c = s[key]?.complexity;
    if (!c) return null;
    const charts = c.files.filter((f) => /charts\.ts$/.test(f.name)).reduce((a, f) => a + f.cyclomatic, 0);
    return c.cyclomatic ? Math.round((charts / c.cyclomatic) * 1000) / 10 : null;
  };
  const wOld = worst("old"), wNew = worst("new");
  let out = "### Cyclomatic offenders (top function per side, charts.ts concentration)\n\n";
  const rows = [
    { label: "worst function", old: wOld ? `${wOld.name} (${wOld.cyc})` : "—", neu: wNew ? `${wNew.name} (${wNew.cyc})` : "—", d: "" },
    { label: "worst file", old: wOld ? wOld.file : "—", neu: wNew ? wNew.file : "—", d: "" },
    { label: "charts.ts share %", old: chartsShare("old") != null ? chartsShare("old") + "%" : "—", neu: chartsShare("new") != null ? chartsShare("new") + "%" : "—", d: "" },
  ];
  out += dimTable(rows, sides) + "\n\n";
  for (const key of sides) {
    const fns = s[key]?.complexity?.topFunctions ?? [];
    if (!fns.length) continue;
    out += `**${key} top functions by cyclomatic:**\n\n`;
    out += table(["fn", "file", "cyc", "nest"], fns.map((f) => [f.name, f.file.replace(/^src\//, ""), f.cyc, f.nest])) + "\n\n";
  }
  return out;
}

function staticTables(s) {
  const sides = [];
  if (s.old) sides.push("old");
  if (s.new) sides.push("new");
  const oc = s.old?.complexity, nc = s.new?.complexity;
  const od = s.old?.duplication, nd = s.new?.duplication;
  const rows = [
    { label: "files (app)", old: oc?.fileCount, neu: nc?.fileCount, d: delta(nc?.fileCount, oc?.fileCount) },
    { label: "lines (app)", old: oc?.lines, neu: nc?.lines, d: delta(nc?.lines, oc?.lines) },
    { label: "functions", old: oc?.functions, neu: nc?.functions, d: delta(nc?.functions, oc?.functions) },
    { label: "cyclomatic Σ", old: oc?.cyclomatic, neu: nc?.cyclomatic, d: delta(nc?.cyclomatic, oc?.cyclomatic) },
    { label: "max fn cyclomatic", old: oc?.maxFunction, neu: nc?.maxFunction, d: delta(nc?.maxFunction, oc?.maxFunction) },
    { label: "max nesting", old: oc?.maxNesting, neu: nc?.maxNesting, d: delta(nc?.maxNesting, oc?.maxNesting) },
    { label: "`any` count", old: oc?.anyCount, neu: nc?.anyCount, d: delta(nc?.anyCount, oc?.anyCount) },
    { label: "duplication %", old: od ? od.percent.toFixed(2) : "—", neu: nd ? nd.percent.toFixed(2) : "—", d: od && nd ? (Number(nd.percent.toFixed(2)) - Number(od.percent.toFixed(2))).toFixed(2) : "—" },
    { label: "JS test files", old: s.old?.tests.js.files, neu: s.new?.tests.js.files, d: delta(s.new?.tests.js.files, s.old?.tests.js.files) },
    { label: "JS test cases", old: s.old?.tests.js.cases, neu: s.new?.tests.js.cases, d: delta(s.new?.tests.js.cases, s.old?.tests.js.cases) },
  ];
  let out = "### App code (complexity corpus: app only, tests excluded both sides)\n\n";
  out += dimTable(rows, sides) + "\n\n";
  if (s.old && s.new) {
    out += "Cloc (all measured files): old " + s.old.cloc.total.code + " code / " + s.old.cloc.total.comment + " comment / " + s.old.cloc.total.blank + " blank over " + s.old.cloc.total.files + " files → new " + s.new.cloc.total.code + " / " + s.new.cloc.total.comment + " / " + s.new.cloc.total.blank + " over " + s.new.cloc.total.files + " files.\n\n";
    out += "**Shared-asset split:** `public/data`, `public/assets/logos`, `public/fonts`, `public/js` (vendored echarts + echarts-gl) and `public/index.html` are unchanged between the two refs — the line/function delta above is the app-only rewrite (vanilla `app.js` → svelte `src/`).\n";
  }
  return out;
}

function loadTables(l) {
  if (!l) return "_no load.json in this run dir._";
  const sides = [];
  if (l.old) sides.push("old");
  if (l.new) sides.push("new");
  let out = "";
  for (const c of CONDITIONS) {
    const oc = l.old?.conditions[c], nc = l.new?.conditions[c];
    const rows = LOAD_METRICS.map(([k, label]) => ({
      label,
      old: oc ? num(oc[k].median) + " (" + num(oc[k].p90) + " p90)" : "—",
      neu: nc ? num(nc[k].median) + " (" + num(nc[k].p90) + " p90)" : "—",
      d: oc && nc ? delta(nc[k].median, oc[k].median) : "—",
    }));
    out += "#### " + c + "\n\n" + dimTable(rows, sides) + "\n\n";
  }
  return out;
}

function coverageTables(c) {
  if (!c) return "_no coverage.json for this run._";
  const sides = [];
  if (c.old) sides.push("old");
  if (c.new) sides.push("new");
  const cell = (side, key) => {
    const v = c[side];
    if (!v) return "—";
    if (v.null) return "no tests at ref";
    if (key === "files") return v.files;
    return v[key] == null ? "—" : v[key] + "%";
  };
  const rows = [
    { label: "lines", old: cell("old", "lines"), neu: cell("new", "lines") },
    { label: "branches", old: cell("old", "branches"), neu: cell("new", "branches") },
    { label: "functions", old: cell("old", "functions"), neu: cell("new", "functions") },
    { label: "statements", old: cell("old", "statements"), neu: cell("new", "statements") },
    { label: "files covered", old: cell("old", "files"), neu: cell("new", "files") },
  ];
  let out = dimTable(rows, sides) + "\n";
  for (const side of sides) {
    if (c[side]?.null) out += `\n_${side}: ${c[side].note.split("\n")[0]}_`;
  }
  return out;
}

function interactTables(i) {
  if (!i) return "_no interact.json in this run dir._";
  const sides = [];
  if (i.old) sides.push("old");
  if (i.new) sides.push("new");
  const rows = INTERACT_METRICS.map(([k, label]) => ({
    label,
    old: i.old ? num(i.old[k].median) + " (" + num(i.old[k].p90) + " p90)" : "—",
    neu: i.new ? num(i.new[k].median) + " (" + num(i.new[k].p90) + " p90)" : "—",
    d: i.old && i.new ? delta(i.new[k].median, i.old[k].median) : "—",
  }));
  return dimTable(rows, sides) + "\n";
}

export async function reportAnalysis(ctx) {
  const { refA, refB, headShort, dirty, buildAt, nodeVersion, chromiumVersion, runs, runDate, outDir } = ctx;
  const s = await read("static.json", outDir).catch(() => {
    throw new Error(`static.json missing in ${resultsDir(outDir)} — run a measuring phase first (e.g. --only static)`);
  });
  const l = await read("load.json", outDir).catch(() => null);
  const i = await read("interact.json", outDir).catch(() => null);
  const c = await read("coverage.json", outDir).catch(() => null);
  const sides = (s.old && s.new) ? "both sides" : s.old ? "old only" : "new only";
  const md = [];
  md.push(`# Refactor benchmark — old \`${refA}\` → new \`${refB || headShort}\``);
  md.push("");
  md.push("## Provenance");
  md.push("");
  md.push("- old ref: `" + refA + "`  ·  new ref: `" + (refB || headShort) + "`");
  md.push("- new build HEAD: `" + headShort + "`  dirty=" + dirty + "  built " + buildAt);
  md.push("- node " + nodeVersion + "  ·  chromium " + chromiumVersion);
  md.push("- runs/side: load " + runs + " × 4 conditions, interactions " + runs + " repeats  ·  run " + runDate + "  ·  measured: " + sides);
  md.push("");
  md.push("## 1. Static analysis");
  md.push("");
  md.push(staticTables(s));
  md.push(cyclomaticOffenders(s));
  md.push("## 2. Load timing (median ms; p90 in parens)");
  md.push("");
  md.push(loadTables(l));
  md.push("## 3. Interactions (median; p90 in parens)");
  md.push("");
  md.push(interactTables(i));
  md.push("## 4. Test coverage (vitest `--coverage`)");
  md.push("");
  md.push(coverageTables(c));
  md.push("## 5. Caveats");
  md.push("");
  md.push("- **Architecture-level, not line-for-line:** old is a single vanilla `app.js` on a global-echarts UMD; new is a svelte 5 + vite bundle that exposes no `window.echarts` global. Interaction probes are DOM/canvas-only so the comparison is fair, but the two are different code shapes (see `01-harness-static.md` A7: new baseline is the pure cutover `e858d24`, excluding the 027 tour + 025 comparator features that landed after it).");
  md.push("- **Feature delta excluded from the new baseline:** guided tour (027) and model comparator (025) are later feature work, not the refactor — they are not in `e858d24`, so the load/interaction deltas isolate the refactor itself.");
  md.push("- **Memory (`performance.memory`) is chromium-only** and reported null-safe; the heap-Δ after the interaction burst is illustrative (GC timing), not a leak signal.");
  md.push("- **Compression:** local A5 gzip/brotli (lib/serve.mjs) matches CF's static-asset compression; `--live` prod numbers are quoted here only when a prod run was reachable (this sandbox has no prod egress, so `--live` was skipped — old+new local numbers stand).");
  md.push("");
  const out = md.join("\n");
  await writeFile(join(resultsDir(outDir), "report.md"), out);
  return out;
}
