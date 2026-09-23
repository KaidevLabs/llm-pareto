// 031 A5/page → 033 A11: generate a self-contained report.html from the run's
// result JSONs — a profile of ONE measured tree (cross-run comparison lives in
// the compare page). No external network requests, no cookies (consistent with
// the site's cookieless rule). All numbers come from
// static/load/interact/coverage/provenance JSONs.
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const num = (x) => (x == null ? "—" : x);

const LOAD_METRICS = [
  ["ttfbMs", "TTFB"], ["dclMs", "DOMContentLoaded"], ["loadMs", "load"], ["fcpMs", "FCP"],
  ["lcpMs", "LCP"], ["chartMs", "chart-paint"], ["requests", "requests"], ["transferKB", "transfer KB"],
];
const INTERACT_METRICS = [
  ["initPaintMs", "init→paint (ms)"], ["zoomSettleMs", "zoom settle (ms)"], ["zoomEvents", "zoom events"],
  ["thrDragSettleMs", "threshold drag settle (ms)"],
  ["drawerOpenMs", "drawer open (ms)"], ["drawerCloseMs", "drawer close (ms)"], ["cold3DMs", "3D cold (ms)"],
  ["steady3DMs", "3D steady (ms)"], ["jankCount", "jank count"], ["jankTBTms", "jank TBT (ms)"],
  ["memLoadKB", "heap load (KB)"], ["memDeltaKB", "heap Δ (KB)"],
];
const CONDITIONS = ["cold-unthrottled", "warm-unthrottled", "cold-throttled", "warm-throttled"];

function table(headers, rows, cls = "") {
  const body = rows
    .map((r) => "<tr>" + r.map((c, i) => `<t${i === 0 ? "h" : "d"}>${c}</t${i === 0 ? "h" : "d"}>`).join("") + "</tr>")
    .join("");
  return `<table class="${cls}"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
}

const valCell = (m) => (m ? `${num(m.median)} <span class="p90">(${num(m.p90)} p90)</span>` : "—");

function kpis(s, l, c) {
  const k = [];
  const cc = s.complexity;
  k.push({ v: cc.cyclomatic, s: "Σ cyclomatic" });
  if (c && !c.null) k.push({ v: c.lines + "%", s: "coverage" });
  if (cc.topFunctions?.[0]) k.push({ v: cc.topFunctions[0].cyc, s: "worst fn: " + cc.topFunctions[0].name, sub: path.basename(cc.topFunctions[0].file) });
  const nChart = l?.conditions?.["cold-unthrottled"]?.chartMs?.median;
  if (nChart != null) k.push({ v: nChart + "ms", s: "chart-paint", sub: "cold / unthrottled" });
  return k;
}

function offendersCard(s) {
  const cc = s.complexity;
  const ch = cc.files.filter((f) => /charts\.ts$/.test(f.name)).reduce((a, f) => a + f.cyclomatic, 0);
  let html = table(["metric", "value"], [
    ["worst function", cc.topFunctions?.[0] ? `${esc(cc.topFunctions[0].name)} (${cc.topFunctions[0].cyc})` : "—"],
    ["charts.ts share", cc.cyclomatic ? Math.round((ch / cc.cyclomatic) * 1000) / 10 + "%" : "—"],
  ]);
  if (cc.topFunctions?.length) {
    html += `<div class="sub">${esc(cc.topFunctions.length)} worst functions by cyclomatic:</div>`;
    html += table(
      ["fn", "file", "cyc", "nest"],
      cc.topFunctions.map((f) => [esc(f.name), esc(path.basename(f.file).replace(/^src\//, "")), f.cyc, f.nest]),
    );
  }
  return html;
}

function loadCard(l) {
  if (!l) return `<p class="muted">no load.json in this run dir</p>`;
  let html = "";
  for (const cond of CONDITIONS) {
    const m = l.conditions?.[cond];
    if (!m) continue;
    html += `<h4>${esc(cond)}</h4>`;
    html += table(["metric", "value"], LOAD_METRICS.map(([k, label]) => [`<th>${esc(label)}</th>`, `<td>${valCell(m[k])}</td>`]));
  }
  return html;
}

function interactCard(i) {
  if (!i) return `<p class="muted">no interact.json in this run dir</p>`;
  return table(["metric", "value"], INTERACT_METRICS.map(([k, label]) => [`<th>${esc(label)}</th>`, `<td>${valCell(i[k])}</td>`]));
}

function coverageCard(c) {
  if (!c) return `<p class="muted">no coverage.json for this run</p>`;
  if (c.null) return `<p class="muted">${esc(c.label)}: ${esc(c.note.split("\n")[0])}</p>`;
  const cell = (key) => (key === "files" ? c[key] : c[key] == null ? "—" : c[key] + "%");
  return table(["metric", "value"], [
    ["lines", cell("lines")], ["branches", cell("branches")], ["functions", cell("functions")],
    ["statements", cell("statements")], ["files covered", cell("files")],
  ]);
}

export async function genPage(outDir) {
  const read = async (f) => {
    try { return JSON.parse(await readFile(path.join(outDir, f), "utf8")); } catch { return null; }
  };
  const s = await read("static.json");
  const l = await read("load.json");
  const i = await read("interact.json");
  const c = await read("coverage.json");
  const p = await read("provenance.json");
  if (!s) throw new Error(`static.json missing in ${outDir}`);

  const label = p ? `${p.ref}${p.dirty ? " (dirty)" : ""}` : "?";
  const k = kpis(s, l, c);

  const kpiHtml = k.map((x) => `<div class="kpi"><div class="kv">${esc(x.v)}</div><div class="ks">${esc(x.s)}</div>${x.sub ? `<div class="ksub">${esc(x.sub)}</div>` : ""}</div>`).join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bench run — ${esc(label)}</title>
<style>
:root { color-scheme: light; --bg:#f6f7f9; --card:#fff; --ink:#1c2230; --mut:#5b6678; --line:#e3e7ee; --pos:#1a7f4b; --neg:#b3261e; --acc:#3b5bdb; }
* { box-sizing: border-box; }
body { margin:0; font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:var(--ink); }
.wrap { max-width: 1080px; margin: 0 auto; padding: 28px 20px 60px; }
header { display:flex; flex-wrap:wrap; align-items:baseline; gap:12px; }
h1 { font-size: 24px; margin:0; }
h2 { font-size: 18px; margin: 34px 0 10px; border-bottom: 2px solid var(--line); padding-bottom:6px; }
h3 { font-size:15px; margin:18px 0 8px; }
h4 { font-size:13px; color:var(--mut); margin:14px 0 4px; text-transform:uppercase; letter-spacing:.04em; }
.pill { font-size:13px; font-weight:600; padding:4px 12px; border-radius:999px; background:#5b6678; color:#fff; }
.sub { font-size:13px; color:var(--mut); margin:10px 0 4px; }
.kpis { display:grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-top:16px; }
.kpi { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
.kv { font-size:22px; font-weight:700; }
.ks { font-size:13px; color:var(--mut); margin-top:2px; }
.ksub { font-size:12px; color:var(--mut); }
.card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px 18px; margin-top:12px; }
table { border-collapse: collapse; width:100%; margin:6px 0 4px; font-size:13.5px; }
th,td { text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); }
thead th { color:var(--mut); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.03em; }
td:not(:first-child), th:not(:first-child) { text-align:right; font-variant-numeric: tabular-nums; }
.p90 { color:var(--mut); font-size:11.5px; }
.muted { color:var(--mut); font-size:13px; }
footer { margin-top:40px; padding-top:14px; border-top:1px solid var(--line); color:var(--mut); font-size:12.5px; }
code { background:#eef0f4; padding:1px 4px; border-radius:4px; font-size:12.5px; }
</style></head>
<body><div class="wrap">
<header>
  <h1>Bench run</h1>
  <span class="pill">${esc(label)}</span>
</header>
<p class="muted">tree <code>${esc(label)}</code> · node ${esc(p?.nodeVersion ?? "")} · chromium ${esc(p?.chromiumVersion ?? "")} · ${num(p?.runs)} runs · ${esc(p?.runDate ?? "")}</p>
<div class="kpis">${kpiHtml}</div>

<h2>1 · Code &amp; complexity</h2>
<div class="card">${offendersCard(s)}</div>

<h2>2 · Load timing</h2>
<div class="card">${loadCard(l)}</div>

<h2>3 · Interactions</h2>
<div class="card">${interactCard(i)}</div>

<h2>4 · Test coverage</h2>
<div class="card">${coverageCard(c)}</div>

<footer>
  Generated by <code>tools/refactor-bench</code> — a profile of one measured tree: static/complexity, per-function cyclomatic, headless load, CDP interactions, and vitest coverage. Cross-run comparison: the published registry's compare page. Self-contained: no external requests, no cookies.
  ${s.notes?.length ? `<br><br><span class="muted">Methodology:</span> ` + s.notes.map((n) => esc(n)).join(" ") : ""}
</footer>
</div></body></html>`;

  await writeFile(path.join(outDir, "report.html"), html);
  return path.join(outDir, "report.html");
}
