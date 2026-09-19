// 031 A5/page: generate a self-contained report.html from the run's result JSONs.
// No external network requests, no cookies (consistent with the site's cookieless
// rule). All numbers come from static/load/interact/coverage/provenance JSONs.
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const num = (x) => (x == null ? "—" : x);
const fmt = (x, unit = "") => (x == null ? "—" : x + unit);
const delta = (n, o) => {
  if (n == null || o == null) return null;
  const d = n - o;
  if (d === 0) return 0;
  return d;
};

const LOAD_METRICS = [
  ["ttfbMs", "TTFB"], ["dclMs", "DOMContentLoaded"], ["loadMs", "load"], ["fcpMs", "FCP"],
  ["lcpMs", "LCP"], ["chartMs", "chart-paint"], ["requests", "requests"], ["transferKB", "transfer KB"],
];
const INTERACT_METRICS = [
  ["initPaintMs", "init→paint (ms)"], ["zoomSettleMs", "zoom settle (ms)"], ["zoomEvents", "zoom events"],
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

function dimRows(keys, dataA, dataB, fmtVal) {
  return keys.map(([k, label]) => {
    const a = dataA ? dataA[k] : null;
    const b = dataB ? dataB[k] : null;
    const d = delta(b?.median ?? null, a?.median ?? null);
    const cells = [`<th>${esc(label)}</th>`];
    if (dataA) cells.push(`<td>${fmtVal(a)}</td>`);
    if (dataB) cells.push(`<td>${fmtVal(b)}</td>`);
    if (dataA && dataB) {
      const cls = d == null ? "" : d > 0 ? "neg" : d < 0 ? "pos" : "";
      cells.push(`<td class="${cls}">${d == null ? "—" : (d > 0 ? "+" : "") + d}</td>`);
    }
    return cells;
  });
}

function verdict(s, l) {
  const o = l.old?.conditions?.["cold-unthrottled"]?.chartMs?.median;
  const n = l.new?.conditions?.["cold-unthrottled"]?.chartMs?.median;
  if (o == null || n == null) return { text: "partial run", kind: "neutral" };
  const rel = (n - o) / o;
  if (Math.abs(rel) < 0.1) return { text: "load-neutral refactor", kind: "neutral" };
  return rel > 0 ? { text: "slower chart paint", kind: "neg" } : { text: "faster chart paint", kind: "pos" };
}

function scorecard(s, c) {
  const items = [];
  const oc = s.old?.complexity, nc = s.new?.complexity;
  if (c?.new && !c?.old) items.push(["strength", `Adds a test suite — ${c.new.lines}% line coverage over ${c.new.files} files`]);
  else if (c?.new && c?.old) items.push(["neutral", `Coverage held: ${c.new.lines}% (new) vs ${c.old.lines}% (old)`]);
  if (oc && nc) {
    if (nc.cyclomatic <= oc.cyclomatic) items.push(["strength", `Cyclomatic Σ dropped ${oc.cyclomatic}→${nc.cyclomatic}`]);
    else items.push(["weakness", `Cyclomatic Σ rose ${oc.cyclomatic}→${nc.cyclomatic}`]);
    if (nc.anyCount < oc.anyCount) items.push(["strength", `\`any\` count cut ${oc.anyCount}→${nc.anyCount}`]);
    else if (nc.anyCount > oc.anyCount) items.push(["weakness", `\`any\` count rose ${oc.anyCount}→${nc.anyCount}`]);
    if (nc.lines > oc.lines) items.push(["neutral", `App code grew ${oc.lines}→${nc.lines} lines (vanilla→svelte)`]);
  }
  return items;
}

function kpis(s, l, c) {
  const oc = s.old?.complexity, nc = s.new?.complexity;
  const nChart = l.new?.conditions?.["cold-unthrottled"]?.chartMs?.median;
  const k = [];
  if (nc) k.push({ v: nc.cyclomatic, s: "Σ cyclomatic (new)", sub: oc ? `${oc.cyclomatic} → ${nc.cyclomatic}` : "" });
  if (c?.new) k.push({ v: c.new.lines + "%", s: "coverage (new)", sub: c.old ? "none at old ref" : "" });
  if (nc?.topFunctions?.[0]) k.push({ v: nc.topFunctions[0].cyc, s: "worst fn: " + nc.topFunctions[0].name, sub: path.basename(nc.topFunctions[0].file) });
  if (nChart != null) k.push({ v: nChart + "ms", s: "chart-paint", sub: "cold / unthrottled" });
  return k;
}

function offendersCard(s) {
  const nc = s.new?.complexity;
  const oc = s.old?.complexity;
  let html = "";
  const share = (c) => {
    if (!c) return null;
    const ch = c.files.filter((f) => /charts\.ts$/.test(f.name)).reduce((a, f) => a + f.cyclomatic, 0);
    return c.cyclomatic ? Math.round((ch / c.cyclomatic) * 1000) / 10 : null;
  };
  const rows = [
    ["worst function", oc?.topFunctions?.[0] ? `${oc.topFunctions[0].name} (${oc.topFunctions[0].cyc})` : "—", nc?.topFunctions?.[0] ? `${nc.topFunctions[0].name} (${nc.topFunctions[0].cyc})` : "—"],
    ["charts.ts share", oc ? share(oc) + "%" : "—", nc ? share(nc) + "%" : "—"],
  ];
  const sides = [oc && "old", nc && "new"].filter(Boolean);
  html += table(["metric", ...sides], rows);
  if (nc) {
    html += `<div class="sub">${esc(nc.topFunctions.length)} worst functions by cyclomatic (new):</div>`;
    html += table(
      ["fn", "file", "cyc", "nest"],
      nc.topFunctions.map((f) => [esc(f.name), esc(path.basename(f.file).replace(/^src\//, "")), f.cyc, f.nest]),
    );
  }
  return html;
}

function loadCard(l) {
  let html = "";
  for (const cond of CONDITIONS) {
    const a = l.old?.conditions?.[cond];
    const b = l.new?.conditions?.[cond];
    if (!a && !b) continue;
    html += `<h4>${esc(cond)}</h4>`;
    const rows = dimRows(LOAD_METRICS, a, b, (m) => (m ? `${num(m.median)} <span class="p90">(${num(m.p90)} p90)</span>` : "—"));
    const headers = ["metric", ...(a ? ["old"] : []), ...(b ? ["new"] : []), ...(a && b ? ["Δ"] : [])];
    html += table(headers, rows);
  }
  return html;
}

function interactCard(i) {
  const a = i.old, b = i.new;
  const rows = dimRows(INTERACT_METRICS, a, b, (m) => (m ? `${num(m.median)} <span class="p90">(${num(m.p90)} p90)</span>` : "—"));
  const headers = ["metric", ...(a ? ["old"] : []), ...(b ? ["new"] : []), ...(a && b ? ["Δ"] : [])];
  return table(headers, rows);
}

function coverageCard(c) {
  if (!c) return `<p class="muted">no coverage.json for this run</p>`;
  const a = c.old, b = c.new;
  const row = (label, key) => [
    `<th>${esc(label)}</th>`,
    a ? `<td>${a.null ? "no tests at ref" : (key === "files" ? a[key] : a[key] + "%")}</td>` : "",
    b ? `<td>${b.null ? "no tests at ref" : (key === "files" ? b[key] : b[key] + "%")}</td>` : "",
  ].filter(Boolean);
  const rows = [
    row("lines", "lines"),
    row("branches", "branches"),
    row("functions", "functions"),
    row("statements", "statements"),
    row("files covered", "files"),
  ];
  const headers = ["metric", ...(a ? ["old"] : []), ...(b ? ["new"] : [])].filter(Boolean);
  let html = table(headers, rows);
  for (const side of [a, b]) if (side?.null) html += `<p class="muted">${esc(side.label)}: ${esc(side.note.split("\n")[0])}</p>`;
  return html;
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

  const v = verdict(s, l ?? { new: {}, old: {} });
  const k = kpis(s, l ?? { new: {}, old: {} }, c);
  const sc = scorecard(s, c);

  const kpiHtml = k.map((x) => `<div class="kpi"><div class="kv">${esc(x.v)}</div><div class="ks">${esc(x.s)}</div>${x.sub ? `<div class="ksub">${esc(x.sub)}</div>` : ""}</div>`).join("");
  const scHtml = sc.map(([kind, txt]) => `<li class="${kind}">${esc(txt)}</li>`).join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Refactor benchmark — ${esc(p?.refA ?? "?")} → ${esc(p?.refB ?? "?")}</title>
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
.pill { font-size:13px; font-weight:600; padding:4px 12px; border-radius:999px; background:var(--acc); color:#fff; }
.pill.neutral { background:#5b6678; } .pill.pos { background:var(--pos); } .pill.neg { background:var(--neg); }
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
.pos { color:var(--pos); } .neg { color:var(--neg); }
ul.score { list-style:none; padding:0; margin:0; }
ul.score li { padding:6px 10px; border-radius:8px; margin:6px 0; border:1px solid var(--line); }
li.strength { border-left:4px solid var(--pos); } li.weakness { border-left:4px solid var(--neg); } li.neutral { border-left:4px solid var(--mut); }
.muted { color:var(--mut); font-size:13px; }
footer { margin-top:40px; padding-top:14px; border-top:1px solid var(--line); color:var(--mut); font-size:12.5px; }
code { background:#eef0f4; padding:1px 4px; border-radius:4px; font-size:12.5px; }
</style></head>
<body><div class="wrap">
<header>
  <h1>Refactor benchmark</h1>
  <span class="pill ${v.kind}">${esc(v.text)}</span>
</header>
<p class="muted">old <code>${esc(p?.refA ?? "?")}</code> → new <code>${esc(p?.refB ?? p?.headShort ?? "?")}</code> · node ${esc(p?.nodeVersion ?? "")} · chromium ${esc(p?.chromiumVersion ?? "")} · ${num(p?.runs)} runs/side · ${esc(p?.runDate ?? "")}</p>
<div class="kpis">${kpiHtml}</div>

<h2>1 · Code &amp; complexity</h2>
<div class="card">${offendersCard(s)}</div>

<h2>2 · Load timing</h2>
<div class="card">${loadCard(l ?? {})}</div>

<h2>3 · Interactions</h2>
<div class="card">${interactCard(i ?? {})}</div>

<h2>4 · Test coverage</h2>
<div class="card">${coverageCard(c)}</div>

<h2>5 · Scorecard</h2>
<div class="card"><ul class="score">${scHtml}</ul></div>

<footer>
  Generated by <code>tools/refactor-bench</code> — static/complexity, per-function cyclomatic, headless load, CDP interactions, and vitest coverage across two git refs. Self-contained: no external requests, no cookies.
  ${s.old?.notes?.length ? `<br><br><span class="muted">Methodology:</span> ` + s.old.notes.map((n) => esc(n)).join(" ") : ""}
</footer>
</div></body></html>`;

  await writeFile(path.join(outDir, "report.html"), html);
  return path.join(outDir, "report.html");
}
