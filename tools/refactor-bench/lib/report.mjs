// 031 A4/report → 033 A11: merge the run's result JSONs → markdown report
// (provenance, per-dimension tables, caveats). One measured tree per run;
// cross-run comparison lives in the compare page, not here.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = (outDir) => (outDir ? outDir : join(here, "..", "results"));
const read = async (f, outDir) => JSON.parse(await (await import("node:fs/promises")).readFile(join(resultsDir(outDir), f), "utf8"));
const num = (x) => (x == null ? "—" : x);

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

const metricTable = (rows) => table(["metric", "value"], rows.map((r) => [r.label, ...r.values]));

function staticTables(s) {
  const c = s.complexity, d = s.duplication;
  const rows = [
    { label: "files (app)", values: [c.fileCount] },
    { label: "lines (app)", values: [c.lines] },
    { label: "functions", values: [c.functions] },
    { label: "cyclomatic Σ", values: [c.cyclomatic] },
    { label: "max fn cyclomatic", values: [c.maxFunction] },
    { label: "max nesting", values: [c.maxNesting] },
    { label: "`any` count", values: [c.anyCount] },
    { label: "duplication %", values: [d ? d.percent.toFixed(2) : "—"] },
    { label: "JS test files", values: [s.tests.js.files] },
    { label: "JS test cases", values: [s.tests.js.cases] },
  ];
  let out = metricTable(rows) + "\n\n";
  const t = s.cloc.total;
  out += `Cloc (all measured files): ${t.code} code / ${t.comment} comment / ${t.blank} blank over ${t.files} files.\n\n`;
  const charts = c.files.filter((f) => /charts\.ts$/.test(f.name)).reduce((a, f) => a + f.cyclomatic, 0);
  if (c.cyclomatic) out += `charts.ts cyclomatic share: ${Math.round((charts / c.cyclomatic) * 1000) / 10}%.\n\n`;
  const fns = c.topFunctions ?? [];
  if (fns.length) {
    out += "**Top functions by cyclomatic:**\n\n";
    out += table(["fn", "file", "cyc", "nest"], fns.map((f) => [f.name, f.file.replace(/^src\//, ""), f.cyc, f.nest])) + "\n\n";
  }
  return out;
}

function loadTables(l) {
  if (!l) return "_no load.json in this run dir._";
  let out = "";
  for (const c of CONDITIONS) {
    const m = l.conditions[c];
    if (!m) continue;
    const rows = LOAD_METRICS.map(([k, label]) => ({ label, values: [num(m[k].median) + " (" + num(m[k].p90) + " p90)"] }));
    out += "#### " + c + "\n\n" + metricTable(rows) + "\n\n";
  }
  return out;
}

function coverageTables(c) {
  if (!c) return "_no coverage.json for this run._";
  if (c.null) return `_no coverage: ${c.note.split("\n")[0]}_`;
  const pct = (k) => (c[k] == null ? "—" : c[k] + "%");
  return metricTable([
    { label: "lines", values: [pct("lines")] },
    { label: "branches", values: [pct("branches")] },
    { label: "functions", values: [pct("functions")] },
    { label: "statements", values: [pct("statements")] },
    { label: "files covered", values: [c.files] },
  ]) + "\n";
}

function interactTables(i) {
  if (!i) return "_no interact.json in this run dir._";
  const rows = INTERACT_METRICS.map(([k, label]) => ({ label, values: [num(i[k].median) + " (" + num(i[k].p90) + " p90)"] }));
  return metricTable(rows) + "\n";
}

export async function reportAnalysis(ctx) {
  const { ref, dirty, buildAt, nodeVersion, chromiumVersion, runs, runDate, outDir } = ctx;
  const s = await read("static.json", outDir).catch(() => {
    throw new Error(`static.json missing in ${resultsDir(outDir)} — run a measuring phase first (e.g. --only static)`);
  });
  const l = await read("load.json", outDir).catch(() => null);
  const i = await read("interact.json", outDir).catch(() => null);
  const c = await read("coverage.json", outDir).catch(() => null);
  const label = `${ref}${dirty ? " (dirty)" : ""}`;
  const md = [];
  md.push(`# Bench run — \`${label}\``);
  md.push("");
  md.push("## Provenance");
  md.push("");
  md.push("- measured tree: `" + ref + "`  dirty=" + dirty + "  built " + (buildAt ?? "—"));
  md.push("- node " + nodeVersion + "  ·  chromium " + chromiumVersion);
  md.push("- runs: load " + runs + " × 4 conditions, interactions " + runs + " repeats  ·  " + runDate);
  md.push("");
  md.push("## 1. Static analysis");
  md.push("");
  md.push(staticTables(s));
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
  md.push("- **Memory (`performance.memory`) is chromium-only** and reported null-safe; the heap-Δ after the interaction burst is illustrative (GC timing), not a leak signal.");
  md.push("- **Compression:** local A5 gzip/brotli (lib/serve.mjs) matches CF's static-asset compression; `--live` prod numbers are quoted here only when a prod run was reachable.");
  md.push("- **Cross-run comparison:** this report describes one tree; compare runs via the published registry (`public/bench/compare.html`), which diffs two entries.");
  md.push("");
  const out = md.join("\n");
  await writeFile(join(resultsDir(outDir), "report.md"), out);
  return out;
}
