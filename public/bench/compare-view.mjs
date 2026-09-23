// 033 step 3 — the bench compare page's shipped view module, loaded by
// public/bench/compare.html (the tested module IS the shipped one:
// tools/refactor-bench/lib/compare-view.test.ts). Pair picking (A1/A2) +
// per-dimension diff rows on the top half; render helpers + a same-origin
// boot on the bottom. Fetches index.json and the two entries' verbatim run
// JSONs only: no third parties, no cookies, no storage (A4 / plan 020).

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const num = (x, dec = 0) => (x == null ? "—" : dec ? Number(x).toFixed(dec) : String(Math.round(x)));

const CONDITIONS = ["cold-unthrottled", "warm-unthrottled", "cold-throttled", "warm-throttled"];

// --- pair picking (A1/A2) --------------------------------------------------

// A1: no params → the last two registry entries. A2: ?a=<id>&b=<id> loads any
// pair; an unknown id or a half-given pair is a visible error, never a blank.
export function pickPair(search, index) {
  const q = new URLSearchParams(search ?? "");
  const idA = q.get("a") || null;
  const idB = q.get("b") || null;
  if (idA == null && idB == null) {
    if (index.length < 2)
      return { error: `registry holds ${index.length} entr${index.length === 1 ? "y" : "ies"} — two are needed to compare` };
    return { a: index[index.length - 2], b: index[index.length - 1] };
  }
  if (idA == null || idB == null)
    return { error: `?a= and ?b= must be given together (missing ${idA == null ? "?a=" : "?b="})` };
  const a = index.find((e) => e.id === idA);
  const b = index.find((e) => e.id === idB);
  const unknown = [a ? null : idA, b ? null : idB].filter(Boolean);
  if (unknown.length) return { error: `unknown entry id: ${unknown.join(", ")}` };
  return { a, b };
}

// --- diff rows -------------------------------------------------------------

// One dimensional row: A/B medians, Δ = B − A, and the polarity-aware verdict
// (`dir` says which direction is an improvement, so coverage rising reads
// better while a load metric rising reads worse).
const row = (label, a, b, dir, dec = 0, suffix = "") => {
  const delta = a == null || b == null ? null : b - a;
  const kind = delta == null ? null : delta === 0 ? "same" : (delta < 0) === (dir === "lower") ? "better" : "worse";
  return { label, a, b, delta, dir, dec, suffix, kind };
};

export function staticRows(sA, sB) {
  const cx = (s, k) => s?.complexity?.[k] ?? null;
  return [
    row("files (app)", cx(sA, "fileCount"), cx(sB, "fileCount"), "lower"),
    row("lines (app)", cx(sA, "lines"), cx(sB, "lines"), "lower"),
    row("functions", cx(sA, "functions"), cx(sB, "functions"), "lower"),
    row("Σ cyclomatic", cx(sA, "cyclomatic"), cx(sB, "cyclomatic"), "lower"),
    row("max fn cyclomatic", cx(sA, "maxFunction"), cx(sB, "maxFunction"), "lower"),
    row("`any` count", cx(sA, "anyCount"), cx(sB, "anyCount"), "lower"),
    row("duplication %", sA?.duplication?.percent ?? null, sB?.duplication?.percent ?? null, "lower", 2),
  ];
}

export function coverageRows(cA, cB) {
  return [
    row("lines", cA?.lines ?? null, cB?.lines ?? null, "higher", 2, "%"),
    row("branches", cA?.branches ?? null, cB?.branches ?? null, "higher", 2, "%"),
    row("functions", cA?.functions ?? null, cB?.functions ?? null, "higher", 2, "%"),
    row("files covered", cA?.files ?? null, cB?.files ?? null, "higher"),
  ];
}

const LOAD_ROWS = [
  ["chartMs", "chart-paint"],
  ["loadMs", "load"],
  ["transferKB", "transfer KB"],
];
const loadVal = (l, cond, key) => l?.conditions?.[cond]?.[key]?.median ?? null;

export function loadRows(lA, lB) {
  return CONDITIONS.filter((cond) => lA?.conditions?.[cond] || lB?.conditions?.[cond]).map((cond) => ({
    condition: cond,
    rows: LOAD_ROWS.map(([key, label]) => row(label, loadVal(lA, cond, key), loadVal(lB, cond, key), "lower")),
  }));
}

const INTERACT_ROWS = [
  ["initPaintMs", "init→paint (ms)"],
  ["zoomSettleMs", "zoom settle (ms)"],
  ["thrDragSettleMs", "threshold drag settle (ms)"],
  ["drawerOpenMs", "drawer open (ms)"],
  ["cold3DMs", "3D cold (ms)"],
  ["steady3DMs", "3D steady (ms)"],
  ["jankCount", "jank count"],
  ["memDeltaKB", "heap Δ (KB)"],
];

export function interactRows(iA, iB) {
  return INTERACT_ROWS.map(([key, label]) =>
    row(label, iA?.[key]?.median ?? null, iB?.[key]?.median ?? null, "lower"),
  );
}

// --- rendering (same card/table language as lib/page.mjs) ------------------

const note = (t) => `<p class="muted">${esc(t)}</p>`;
const cell = (v, r) => (v == null ? "—" : num(v, r.dec) + r.suffix);
const dtxt = (r) => (r.delta == null ? "—" : (r.delta > 0 ? "+" : "") + num(r.delta, r.dec) + r.suffix);
const dcls = (r) => (r.kind === "better" ? "pos" : r.kind === "worse" ? "neg" : "");

function diffTable(rows, labelA, labelB) {
  const head = ["metric", labelA, labelB, "Δ"].map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr><th>${esc(r.label)}</th><td>${cell(r.a, r)}</td><td>${cell(r.b, r)}</td><td class="${dcls(r)}">${dtxt(r)}</td></tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function sideLine(tag, e, d) {
  const p = d.provenance;
  const bits = [
    `<span class="tag">${tag}</span>`,
    `<code>${esc(e.label)}</code>`,
    ...(p ? [`node ${esc(p.nodeVersion ?? "?")}`, `chromium ${esc(p.chromiumVersion ?? "?")}`] : []),
    p?.runDate || e.date ? String(p?.runDate ?? e.date).slice(0, 16).replace("T", " ") + " UTC" : "",
    `<a href="./${encodeURIComponent(e.id)}/report.html">full report</a>`,
  ].filter(Boolean);
  return `<p class="sub">${bits.join(" · ")}</p>`;
}

function pickerHtml(index, selA, selB) {
  const opts = (sel) =>
    index
      .map((e) => `<option value="${esc(e.id)}"${e.id === sel ? " selected" : ""}>${esc(e.label)} — ${esc(e.id)}</option>`)
      .join("");
  return `<div class="card picker">
<label>baseline (A)<select data-sel="a">${opts(selA)}</select></label>
<label>candidate (B)<select data-sel="b">${opts(selB)}</select></label>
<button data-go>Compare</button>
</div>`;
}

function wirePicker(root) {
  const selA = root.querySelector('[data-sel="a"]');
  const selB = root.querySelector('[data-sel="b"]');
  const go = root.querySelector("[data-go]");
  if (!selA || !selB || !go) return;
  go.addEventListener("click", () => {
    const u = new URL(location.href);
    u.search = "";
    u.searchParams.set("a", selA.value);
    u.searchParams.set("b", selB.value);
    location.assign(u.toString());
  });
}

function section(title, missing, html) {
  return `<h2>${title}</h2><div class="card">${missing ? note(`no ${missing} in either entry`) : html}</div>`;
}

function renderError(root, message, index, selA, selB) {
  root.innerHTML =
    `<header><h1>Bench compare</h1><span class="pill muted-pill">no comparison</span></header>` +
    `<div class="card"><p class="err">${esc(message)}</p>${index ? `<p class="muted">Pick two published entries below.</p>` : ""}</div>` +
    (index ? pickerHtml(index, selA, selB) : "");
  wirePicker(root);
}

function renderCompare(root, index, ea, eb, dA, dB) {
  const load = loadRows(dA.load, dB.load);
  const covNotes = [dA.coverage, dB.coverage]
    .filter((c) => c?.null)
    .map((c) => note(`${c.label ?? "coverage"}: ${String(c.note ?? "").split("\n")[0]}`))
    .join("");
  const sections = [
    section(
      "1 · Code &amp; complexity",
      !dA.static && !dB.static ? "static.json" : null,
      diffTable(staticRows(dA.static, dB.static), ea.label, eb.label),
    ),
    section(
      "2 · Test coverage",
      !dA.coverage && !dB.coverage ? "coverage.json" : null,
      diffTable(coverageRows(dA.coverage, dB.coverage), ea.label, eb.label) + covNotes,
    ),
    section(
      "3 · Load timing",
      !dA.load && !dB.load ? "load.json" : null,
      load.map((g) => `<h4>${esc(g.condition)}</h4>` + diffTable(g.rows, ea.label, eb.label)).join(""),
    ),
    section(
      "4 · Interactions",
      !dA.interact && !dB.interact ? "interact.json" : null,
      diffTable(interactRows(dA.interact, dB.interact), ea.label, eb.label),
    ),
  ].join("");
  root.innerHTML =
    `<header><h1>Bench compare</h1><span class="pill">${esc(ea.label)} → ${esc(eb.label)}</span></header>` +
    `<p class="sub"><strong>A</strong> baseline → <strong>B</strong> candidate; Δ = B − A. <span class="pos">green</span> = better, <span class="neg">red</span> = worse.</p>` +
    sideLine("A", ea, dA) +
    sideLine("B", eb, dB) +
    pickerHtml(index, ea.id, eb.id) +
    sections;
  wirePicker(root);
}

// --- boot ------------------------------------------------------------------

const FILES = {
  static: "static.json",
  coverage: "coverage.json",
  load: "load.json",
  interact: "interact.json",
  provenance: "provenance.json",
};

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

async function loadEntry(entry) {
  const out = {};
  await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => {
      out[key] =
        entry.files?.includes(file) ? await getJSON(`./${encodeURIComponent(entry.id)}/${file}`).catch(() => null) : null;
    }),
  );
  return out;
}

async function boot() {
  const root = document.querySelector("[data-compare]");
  if (!root) return;
  let index;
  try {
    index = await getJSON("./index.json");
  } catch (e) {
    renderError(root, `could not load the bench registry (index.json): ${e.message}`);
    return;
  }
  if (!Array.isArray(index)) {
    renderError(root, "bench registry index.json is not a list");
    return;
  }
  const defaults = { a: index[Math.max(0, index.length - 2)]?.id, b: index[index.length - 1]?.id };
  const pick = pickPair(location.search, index);
  if (pick.error) {
    renderError(root, pick.error, index, defaults.a, defaults.b);
    return;
  }
  const [dA, dB] = await Promise.all([loadEntry(pick.a), loadEntry(pick.b)]);
  document.title = `Bench compare — ${pick.a.label} vs ${pick.b.label}`;
  renderCompare(root, index, pick.a, pick.b, dA, dB);
}

if (typeof document !== "undefined") {
  boot().catch((e) => {
    const root = document.querySelector("[data-compare]");
    if (root) renderError(root, `compare page failed: ${e?.message ?? e}`);
  });
}