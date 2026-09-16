"use strict";

const $ = (s) => document.querySelector(s);

const ORG_COLORS = [
  "#58a6ff", "#3fb950", "#f78166", "#d2a8ff", "#ffa657", "#7ee787",
  "#ff7b72", "#56d4dd", "#db61a2", "#e3b341", "#9ecbff", "#f472b6",
  "#a5b4fc", "#86efac", "#fda4af", "#fcd34d",
];
const ORG_FALLBACK = "#64748b";
const FRONTIER = "#34d399";
const OVERRIDE = "#ffd166";

// Chart grid insets (single source: axis geometry the y-strip wheel handler
// needs too) and per-panel zoom windows captured across re-renders (018 A2).
const GRID = { left: 58, right: 24, top: 26, bottom: 56 };
const ZOOM = {};

const state = {
  mode: "general",
  vision: "all",
  families: new Set(),
  frontier: true,
  spread: false,
  ratio: 3,
};
let DATA = [];
let META = null;
let ORG_COLOR = {};
let charts = {};

function orgOf(d) {
  return d.arena_org && d.arena_org.trim() !== ""
    ? d.arena_org
    : d.or_id.split("/")[0];
}

function buildOrgColors(data) {
  const counts = {};
  for (const d of data) {
    const o = orgOf(d);
    counts[o] = (counts[o] || 0) + 1;
  }
  const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const map = {};
  sorted.forEach((o, i) => {
    map[o] = i < ORG_COLORS.length ? ORG_COLORS[i] : ORG_FALLBACK;
  });
  return map;
}

// Model family, derived mechanically from the OpenRouter display name
// (plan 004 D1'; owner directive: families are 100% source-derived, no
// hand-curated map). From or_name: drop parentheticals and the "Org: "
// prefix, drop date and size tokens; a single letter+digit token reduces
// to the letter ("o1" -> "O"), a word+digit token keeps letters plus the
// major version ("Qwen3.5" -> "Qwen3", "GPT-5.6" -> "GPT-5"), otherwise
// the leading word plus a following word ("Claude Opus"). Families follow
// the source: when OR renames a line, they move on the next data refresh.
const FAMILY_NOISE = new Set(["instruct", "thinking", "preview", "latest", "chat", "beta"]);

function familyOf(d) {
  const body = (d.or_name || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/^[A-Za-z0-9 .&'-]+:\s*/, "")
    .trim();
  if (!body) return orgOf(d);
  const parts = body.split(/[\s-]+/).filter(Boolean);
  const join = body.split(" ")[0].includes("-") ? "-" : " ";
  const isVer = (t) => /^\d+(\.\d+)*[a-z]{0,2}$/i.test(t);
  const isSize = (t) => /^\d+x?\d*b$/i.test(t) || /^[a-z]\d+b$/i.test(t);
  const isDate = (t) => /^\d{4}$/.test(t);
  const isWord = (t) => !!t && !isVer(t) && !isSize(t) && !isDate(t) && !FAMILY_NOISE.has(t.toLowerCase());
  const major = (t) => /\d+(\.\d+)*/.exec(t)[0].split(".")[0];
  const t0 = parts[0];
  let m;
  if ((m = /^([a-z])\d/i.exec(t0))) return m[1].toUpperCase();
  if ((m = /^([a-z]{2,})\d/i.exec(t0))) return t0.slice(0, m[1].length) + major(t0);
  const t1 = parts[1];
  if (t1 && isVer(t1)) return t0 + join + major(t1);
  if (t1 && /^[a-z]\d/i.test(t1)) return t0 + join + t1[0].toUpperCase();
  const w = [t1, ...parts.slice(2)].find(isWord);
  return w ? t0 + join + w.replace(/\+/g, "") : t0;
}

function withAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function fmtPrice(v) {
  if (v == null) return "—";
  if (v === 0) return "$0";
  if (v < 0.01) return "$" + v.toFixed(4);
  if (v < 1) return "$" + v.toFixed(3);
  if (v < 10) return "$" + v.toFixed(2);
  return "$" + Math.round(v);
}

function fmtVotes(v) {
  if (v == null) return "—";
  if (v >= 1000) return Math.round(v / 1000) + "k";
  return String(v);
}

function filtered() {
  let rows = DATA;
  if (state.families.size) rows = rows.filter((d) => state.families.has(orgOf(d) + "|" + familyOf(d)));
  if (state.vision === "vision") rows = rows.filter((d) => d.vision);
  return rows;
}

// Blended $/M for the current input:output mix; falls back to the one
// available price when the other is missing.
function blendedPrice(d) {
  const pin = d.price_in_per_m;
  const pout = d.price_out_per_m;
  if (pin == null || pout == null) return pin != null ? pin : pout;
  const w = state.ratio / (state.ratio + 1);
  return w * pin + (1 - w) * pout;
}

function pointsFor(getPrice, rows) {
  const pts = [];
  let skipped = 0;
  for (const d of rows) {
    const price = getPrice(d);
    if (price == null || d.arena_elo == null) {
      skipped++;
      continue;
    }
    pts.push({ value: [price, d.arena_elo], d });
  }
  return { pts, skipped };
}

// Pareto frontier: no other point has both lower price and higher elo.
// points are [price, elo]; the frontier trades lower price for lower elo.
function paretoFrontier(pts) {
  const out = [];
  for (const p of pts) {
    let dominated = false;
    for (const q of pts) {
      if (q === p) continue;
      if (
        q.value[0] <= p.value[0] &&
        q.value[1] >= p.value[1] &&
        (q.value[0] < p.value[0] || q.value[1] > p.value[1])
      ) {
        dominated = true;
        break;
      }
    }
    if (!dominated) out.push(p);
  }
  out.sort((a, b) => a.value[0] - b.value[0]);
  return out;
}

function bubbleSize(votes, lo, hi) {
  const t = (Math.sqrt(Math.max(votes, 0)) - Math.sqrt(lo)) /
    (Math.sqrt(hi) - Math.sqrt(lo) || 1);
  return 5 + Math.max(0, Math.min(1, t)) * 25;
}

function tooltipHTML(p) {
  const d = p.d;
  const ci = d.arena_elo_upper != null && d.arena_elo_lower != null
    ? " (±" + Math.round(d.arena_elo_upper - d.arena_elo) + ")"
    : "";
  const match =
    d.match_method === "override"
      ? '<div style="color:' + OVERRIDE + '">⚑ manual override — identity fixed by owner decision, price final</div>'
      : "match: " + d.match_method + (d.match_ratio ? " (similarity " + d.match_ratio + ")" : "");
  const parts = [
    '<div style="font-weight:600;font-size:13px">' + d.or_name + "</div>",
    '<div style="color:#8b98ab;font-size:11px;margin-bottom:6px">' + d.or_id + "</div>",
    "arena #" + d.arena_rank +
      " · elo " + d.arena_elo.toFixed(1) + ci +
      " · " + fmtVotes(d.arena_votes) + " votes",
    (state.mode === "general"
      ? fmtPrice(blendedPrice(d)) + " blended (" + state.ratio + ":1) · "
      : "") +
    fmtPrice(d.price_in_per_m) + " in · " + fmtPrice(d.price_out_per_m) +
      " out <span style='color:#8b98ab'>per M tokens</span>",
    orgOf(d) +
      (d.arena_license ? " · " + d.arena_license : "") +
      (d.context_length ? " · " + fmtVotes(d.context_length) + " ctx" : "") +
      (d.vision ? " · ✨ vision" : ""),
    '<div style="margin-top:4px">' + match + "</div>",
  ];
  return parts.join('<br>');
}

// Fit-to-data axis bounds (plan 018 A1): computed at render time from ALL
// joined data — never hardcoded, never from the filtered set (A2) — padded
// and snapped so edge bubbles stay unclipped and tick labels stay inside.
function fitLinear(vals) {
  let lo = Infinity, hi = -Infinity;
  for (const v of vals) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) return null;
  const pad = (hi - lo) * 0.05;
  return {
    min: Math.floor((lo - pad) / 25) * 25,
    max: Math.ceil((hi + pad) / 25) * 25,
  };
}

function fitLog(vals) {
  const pos = vals.filter((v) => v > 0);
  if (!pos.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const v of pos) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const pad = Math.log10(hi / lo) * 0.1;
  return {
    min: Math.pow(10, Math.log10(lo) - pad),
    max: Math.pow(10, Math.log10(hi) + pad),
  };
}

function chartOption(label, pts, frontier, spreadPts, bounds) {
  const votes = pts.map((p) => p.d.arena_votes || 1);
  const lo = Math.min.apply(null, votes);
  const hi = Math.max.apply(null, votes);
  const series = [];

  if (spreadPts && spreadPts.length) {
    series.push({
      name: "spread",
      type: "custom",
      silent: true,
      z: 4,
      data: spreadPts,
      renderItem: (params, api) => {
        const pin = api.value(0);
        const pout = api.value(1);
        const elo = api.value(2);
        if (pin == null || pout == null || pin >= pout) return;
        const s = api.coord([pin, elo]);
        const e = api.coord([pout, elo]);
        const left = [
          { offset: 0, color: "rgba(96, 165, 250, 0.55)" },
          { offset: 1, color: "rgba(245, 158, 11, 0.55)" },
        ];
        const right = [
          { offset: 0, color: "rgba(245, 158, 11, 0.55)" },
          { offset: 1, color: "rgba(96, 165, 250, 0.55)" },
        ];
        return {
          type: "line",
          shape: { x1: s[0], y1: s[1], x2: e[0], y2: e[1] },
          style: {
            stroke: new echarts.graphic.LinearGradient(
              0,
              0.5,
              1,
              0.5,
              pin <= pout ? left : right
            ),
            lineWidth: 2,
          },
        };
      },
    });
  }

  if (state.frontier && frontier.length > 0) {
    series.push({
      name: "Pareto frontier",
      type: "line",
      data: frontier.map((p) => p.value),
      symbol: "circle",
      symbolSize: 7,
      itemStyle: { color: FRONTIER, borderColor: "#06080d", borderWidth: 1 },
      lineStyle: {
        color: withAlpha(FRONTIER, 0.85),
        width: 2,
        shadowColor: withAlpha(FRONTIER, 0.55),
        shadowBlur: 14,
      },
      z: 6,
      tooltip: {
        formatter: (p) => {
          const pt = frontier[p.dataIndex];
          return "<b>frontier</b><br>" + tooltipHTML(pt);
        },
      },
    });
  }

  series.push({
    name: "models",
    type: "scatter",
    data: pts.map((p) => {
      const d = p.d;
      const ov = d.match_method === "override";
      const color = ORG_COLOR[orgOf(d)] || ORG_FALLBACK;
      return {
        value: p.value,
        d: d,
        symbolSize: bubbleSize(d.arena_votes, lo, hi),
        itemStyle: {
          color: withAlpha(color, 0.78),
          borderColor: ov ? OVERRIDE : withAlpha(color, 1),
          borderWidth: ov ? 2 : 0.6,
          shadowBlur: d.arena_rank <= 10 ? 10 : 0,
          shadowColor: withAlpha(color, 0.5),
        },
      };
    }),
    z: 5,
  });

  return {
    backgroundColor: "transparent",
    animationDuration: 450,
    grid: GRID,
    // TradingView model (018 A3/A4): wheel zooms x (price) natively; wheel on
    // the y-axis strip zooms Elo via a custom handler; drag pans both. The
    // y dataZoom's own wheel zoom is off. filterMode 'none' everywhere: the
    // frontier line is only ever clipped, never re-connected (A4).
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      {
        type: "inside",
        yAxisIndex: 0,
        filterMode: "none",
        zoomOnMouseWheel: false,
      },
    ],
    tooltip: {
      backgroundColor: "rgba(10,14,23,0.94)",
      borderColor: "rgba(148,163,184,0.25)",
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      confine: true,
      formatter: (p) => (p.seriesName === "models" ? tooltipHTML(p.data) : p.tooltip),
    },
    xAxis: {
      type: "log",
      ...(bounds.x || {}),
      name: label,
      nameLocation: "middle",
      nameGap: 38,
      nameTextStyle: { color: "#8b98ab", fontSize: 11 },
      axisLine: { show: true, lineStyle: { color: "rgba(148,163,184,0.25)" } },
      axisLabel: {
        color: "#8b98ab",
        fontSize: 11,
        formatter: (v) => (v >= 1 ? "$" + v : "$" + v.toFixed(2)),
      },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.07)" } },
    },
    yAxis: {
      type: "value",
      ...(bounds.y || {}),
      name: "Arena Elo",
      nameLocation: "middle",
      nameGap: 40,
      nameTextStyle: { color: "#8b98ab", fontSize: 11 },
      axisLine: { show: true, lineStyle: { color: "rgba(148,163,184,0.25)" } },
      axisLabel: { color: "#8b98ab", fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.07)" } },
    },
    series,
  };
}

function captureZoom(chart, id) {
  const dz = chart.getOption().dataZoom || [];
  const z = {};
  for (const d of dz) {
    if (d.xAxisIndex === 0) z.x = { start: d.start, end: d.end };
    if (d.yAxisIndex === 0) z.y = { start: d.start, end: d.end };
  }
  ZOOM[id] = z;
}

function resetZoom(chart, id) {
  ZOOM[id] = { x: { start: 0, end: 100 }, y: { start: 0, end: 100 } };
  chart.dispatchAction({ type: "dataZoom", dataZoomIndex: 0, start: 0, end: 100 });
  chart.dispatchAction({ type: "dataZoom", dataZoomIndex: 1, start: 0, end: 100 });
}

// Wheel on the y-axis strip zooms Elo anchored at the cursor (ECharts can't
// scope inside-zoom to the axis strip — 018 A3). Zoom-out clamps at the fit
// bounds (the axis extent): the fit view is the widest window, axes never
// rescale behind the viewer (A1/A4).
function bindZoomChart(chart, id) {
  const dom = chart.getDom();
  chart.on("datazoom", () => captureZoom(chart, id));
  dom.addEventListener(
    "wheel",
    (e) => {
      if (e.offsetX > GRID.left) return; // plot area: ECharts zooms x natively
      e.preventDefault();
      const y = (p) =>
        chart.convertFromPixel({ seriesIndex: 0 }, [0, p])[1];
      const h = dom.clientHeight;
      const anchor = y(e.offsetY);
      const top = y(GRID.top);
      const bot = y(h - GRID.bottom);
      const factor = e.deltaY < 0 ? 0.85 : 1.18;
      let lo = anchor - (anchor - bot) * factor;
      let hi = anchor + (top - anchor) * factor;
      const ext = chart.getOption().yAxis[0];
      lo = Math.max(lo, ext.min);
      hi = Math.min(hi, ext.max);
      if (!(hi > lo)) return;
      chart.dispatchAction({
        type: "dataZoom",
        dataZoomIndex: 1,
        startValue: lo,
        endValue: hi,
      });
    },
    { passive: false }
  );
  dom.addEventListener("dblclick", () => resetZoom(chart, id));
}

function renderPanel(panelKey) {
  const isBlend = panelKey === "blend";
  const priceKey =
    panelKey === "in" ? "price_in_per_m" : "price_out_per_m";
  const getPrice = isBlend ? blendedPrice : (d) => d[priceKey];
  const axisLabel = isBlend
    ? "$/M tokens · " + state.ratio + ":1 in:out blend (log)"
    : "$/M " + (panelKey === "in" ? "input" : "output") + " tokens (log)";

  const rows = filtered();
  const { pts, skipped } = pointsFor(getPrice, rows);
  const frontier = paretoFrontier(pts);
  const spreadPts =
    isBlend && state.spread
      ? pts.map((p) => [
          p.d.price_in_per_m,
          p.d.price_out_per_m,
          p.value[1],
        ])
      : null;

  // Axes are fitted to ALL joined data, not the filtered set (018 A1/A2):
  // they never move when a filter changes. With spread bars on, the blend
  // panel's x range also covers the real in/out prices the bars span.
  let xvals = pointsFor(getPrice, DATA).pts.map((p) => p.value[0]);
  if (isBlend && state.spread) {
    for (const d of DATA) {
      if (d.price_in_per_m > 0) xvals.push(d.price_in_per_m);
      if (d.price_out_per_m > 0) xvals.push(d.price_out_per_m);
    }
  }
  const bounds = {
    x: fitLog(xvals),
    y: fitLinear(
      DATA.map((d) => d.arena_elo).filter((v) => v != null)
    ),
  };

  const id = "chart-" + panelKey;
  const el = document.getElementById(id);
  if (!charts[id]) {
    charts[id] = echarts.init(el, null, { renderer: "canvas" });
    bindZoomChart(charts[id], id);
  }
  charts[id].setOption(
    chartOption(axisLabel, pts, frontier, spreadPts, bounds),
    true
  );

  // The zoom window survives the not-Merge setOption (018 A2).
  const z = ZOOM[id];
  if (z) {
    if (z.x)
      charts[id].dispatchAction({
        type: "dataZoom",
        dataZoomIndex: 0,
        start: z.x.start,
        end: z.x.end,
      });
    if (z.y)
      charts[id].dispatchAction({
        type: "dataZoom",
        dataZoomIndex: 1,
        start: z.y.start,
        end: z.y.end,
      });
  }

  document.getElementById("badge-" + panelKey).classList.toggle(
    "hidden",
    !state.frontier || frontier.length === 0
  );
  document.getElementById("count-" + panelKey).textContent =
    pts.length + " models" + (skipped ? " · " + skipped + " skipped (no price)" : "");
}

function render() {
  const main = document.getElementById("main");
  main.setAttribute("data-mode", state.mode);
  document.getElementById("ratio-ctl").classList.toggle(
    "hidden",
    state.mode !== "general"
  );
  document.getElementById("legend-spread").classList.toggle(
    "hidden",
    state.mode !== "general"
  );
  if (state.mode === "general") renderPanel("blend");
  else if (state.mode === "in") renderPanel("in");
  else renderPanel("out");
  for (const id of Object.keys(charts)) {
    if (charts[id].getDom().offsetParent !== null) charts[id].resize();
  }
}

function renderFooter() {
  const f = document.getElementById("footer");
  const join = (META && META.join) || {};
  const by = join.by_method || {};
  const methods = Object.keys(by)
    .map((k) => by[k] + " " + k)
    .join(" · ");
  const ov = join.overrides_applied || [];
  const ovLine = ov.length
    ? '<div class="ov"><span class="diamond">⚑</span> Manual overrides: ' +
      ov
        .map((o) => o.arena + " → " + o.openrouter_id)
        .join(", ") +
      " — where the arena name is ambiguous, an explicit manual override fixes the model identity; that price is final. Overridden points are outlined in gold on the chart.</div>"
    : "";
  f.innerHTML =
    '<div id="legend-spread"><span class="swatch"></span>' +
    "Spread bar: each model's real price range on the log axis — " +
    '<span class="ink">blue end = input</span>, ' +
    '<span class="outk">amber end = output</span> $/M. ' +
    "The point is the blended price at the slider's input:output ratio; " +
    "a long bar means output tokens cost disproportionately more than input.<br>" +
    'Sources: <a href="https://lmarena.ai/leaderboard/text" target="_blank" rel="noopener">LMArena text leaderboard</a> · ' +
    '<a href="https://openrouter.ai/models" target="_blank" rel="noopener">OpenRouter models</a> · ' +
    "data " + ((META && META.fetched_at) || "unknown") +
    '<br>' +
    (join.combined != null ? join.combined + " models joined (arena ∩ openrouter) · " : "") +
    (methods ? "join: " + methods : "") +
    ovLine;
  document.getElementById("stamp").innerHTML =
    "<b>" + (DATA.length || 0) + "</b> models · updated " +
    ((META && META.fetched_at) || "—");
}

// Org/family accordion panel (plan 004 D3): multi-select tree — a leaf is
// "org|family"; an org row toggles all its children (union semantics, no
// exclusions); the searcher filters tree nodes only (model search is 010's).
let OF_PER = null;
let OF_ROWS = null;
const OF_EXPANDED = new Set();

function buildOfPanel() {
  OF_PER = {};
  for (const d of DATA) {
    const o = orgOf(d), f = familyOf(d);
    OF_PER[o] = OF_PER[o] || {};
    OF_PER[o][f] = (OF_PER[o][f] || 0) + 1;
  }
  OF_ROWS = { org: {}, leaf: {} };
  const panel = document.getElementById("of-panel");
  const search = document.createElement("input");
  search.type = "search";
  search.className = "ofsearch";
  search.id = "of-search";
  search.placeholder = "Filter orgs & families…";
  search.setAttribute("aria-label", "filter orgs and families");
  panel.appendChild(search);
  const tree = document.createElement("div");
  tree.id = "of-tree";
  panel.appendChild(tree);
  for (const o of Object.keys(ORG_COLOR)) {
    const fams = OF_PER[o];
    if (!fams) continue;
    const total = Object.values(fams).reduce((x, y) => x + y, 0);
    const org = document.createElement("div");
    org.className = "oforg";
    org.dataset.org = o;
    org.setAttribute("role", "button");
    org.setAttribute("tabindex", "0");
    const chev = document.createElement("button");
    chev.className = "ofchev";
    chev.textContent = "▸";
    chev.setAttribute("aria-label", "expand " + o);
    const name = document.createElement("span");
    name.className = "ofname";
    name.textContent = o;
    const count = document.createElement("span");
    count.className = "ofcount";
    count.textContent = String(total);
    const chip = document.createElement("span");
    chip.className = "ofchip";
    org.appendChild(chev);
    org.appendChild(name);
    org.appendChild(count);
    org.appendChild(chip);
    const kids = document.createElement("div");
    kids.className = "offams hidden";
    kids.dataset.kids = o;
    for (const f of Object.keys(fams).sort((a, b) => fams[b] - fams[a] || a.localeCompare(b))) {
      const row = document.createElement("div");
      row.className = "offam";
      row.dataset.key = o + "|" + f;
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      const fname = document.createElement("span");
      fname.className = "ofname";
      fname.textContent = f;
      const fcount = document.createElement("span");
      fcount.className = "ofcount";
      fcount.textContent = String(fams[f]);
      const fchip = document.createElement("span");
      fchip.className = "ofchip";
      row.appendChild(fname);
      row.appendChild(fcount);
      row.appendChild(fchip);
      OF_ROWS.leaf[o + "|" + f] = { row, chip: fchip };
      kids.appendChild(row);
    }
    OF_ROWS.org[o] = { row: org, kids, chip, chev };
    tree.appendChild(org);
    tree.appendChild(kids);
  }
}

function toggleOfOpen(o, force) {
  const open = force !== undefined ? force : !OF_EXPANDED.has(o);
  if (open) OF_EXPANDED.add(o);
  else OF_EXPANDED.delete(o);
  OF_ROWS.org[o].kids.classList.toggle("hidden", !open);
  OF_ROWS.org[o].chev.classList.toggle("open", open);
}

function applyOfSearch() {
  const q = document.getElementById("of-search").value.trim().toLowerCase();
  for (const [o, fams] of Object.entries(OF_PER)) {
    const org = OF_ROWS.org[o];
    const orgHit = !q || o.toLowerCase().includes(q);
    let kidHits = 0;
    for (const f of Object.keys(fams)) {
      const hit = orgHit || f.toLowerCase().includes(q);
      OF_ROWS.leaf[o + "|" + f].row.classList.toggle("hidden", q ? !hit : false);
      if (hit) kidHits++;
    }
    org.row.classList.toggle("hidden", q ? !(orgHit || kidHits) : false);
    const open = q ? kidHits > 0 : OF_EXPANDED.has(o);
    org.kids.classList.toggle("hidden", !open);
    org.chev.classList.toggle("open", open);
  }
}

function updateOfPanel() {
  let models = 0;
  for (const [o, fams] of Object.entries(OF_PER)) {
    const keys = Object.keys(fams);
    let on = 0;
    for (const f of keys) {
      const act = state.families.has(o + "|" + f);
      if (act) {
        models += fams[f];
        on++;
      }
      const leaf = OF_ROWS.leaf[o + "|" + f];
      leaf.row.classList.toggle("on", act);
      leaf.chip.textContent = act ? "on" : "";
    }
    const full = on === keys.length;
    const org = OF_ROWS.org[o];
    org.row.classList.toggle("on", full);
    org.row.classList.toggle("part", on > 0 && !full);
    org.chip.textContent = full ? "on" : on > 0 ? "part" : "";
  }
  const badge = document.getElementById("of-badge");
  badge.textContent = models ? String(models) : "";
  badge.classList.toggle("hidden", !models);
}

function toggleOfLeaf(key) {
  if (state.families.has(key)) state.families.delete(key);
  else state.families.add(key);
  updateOfPanel();
  render();
}

function toggleOfOrg(o) {
  const keys = Object.keys(OF_PER[o] || {}).map((f) => o + "|" + f);
  const all = keys.every((k) => state.families.has(k));
  for (const k of keys) {
    if (all) state.families.delete(k);
    else state.families.add(k);
  }
  updateOfPanel();
  render();
}

function bindOfPanel() {
  const ofToggle = document.getElementById("of-toggle");
  const ofPanel = document.getElementById("of-panel");
  const setOfOpen = (open) => {
    ofPanel.classList.toggle("hidden", !open);
    ofToggle.classList.toggle("on", open);
    ofToggle.setAttribute("aria-expanded", String(open));
    if (open) document.getElementById("of-search").focus();
  };
  ofToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setOfOpen(ofPanel.classList.contains("hidden"));
  });
  document.addEventListener("click", (e) => {
    if (!ofPanel.classList.contains("hidden") && !ofPanel.contains(e.target) && !ofToggle.contains(e.target)) {
      setOfOpen(false);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || ofPanel.classList.contains("hidden")) return;
    const q = document.getElementById("of-search");
    if (document.activeElement === q && q.value) {
      q.value = "";
      applyOfSearch();
      return;
    }
    setOfOpen(false);
  });
  const ofActivate = (e) => {
    const chev = e.target.closest(".ofchev");
    if (chev) {
      toggleOfOpen(chev.parentElement.dataset.org);
      return;
    }
    const fam = e.target.closest(".offam");
    if (fam) {
      toggleOfLeaf(fam.dataset.key);
      return;
    }
    const org = e.target.closest(".oforg");
    if (org) toggleOfOrg(org.dataset.org);
  };
  ofPanel.addEventListener("click", ofActivate);
  ofPanel.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".oforg,.offam")) {
      e.preventDefault();
      ofActivate(e);
    }
  });
  document.getElementById("of-search").addEventListener("input", applyOfSearch);
}

function bindFilters() {
  const segMode = document.getElementById("seg-mode");
  segMode.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mode]");
    if (!b) return;
    segMode.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    state.mode = b.getAttribute("data-mode");
    render();
  });
  const segVision = document.getElementById("seg-vision");
  segVision.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-vision]");
    if (!b) return;
    segVision.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    state.vision = b.getAttribute("data-vision");
    render();
  });
  bindOfPanel();
  const spreadTgl = document.getElementById("tgl-spread");
  spreadTgl.addEventListener("click", () => {
    state.spread = !state.spread;
    spreadTgl.classList.toggle("on", state.spread);
    if (state.mode === "general") renderPanel("blend");
  });
  const slider = document.getElementById("ratio-slider");
  slider.addEventListener("input", () => {
    state.ratio = +slider.value;
    document.getElementById("ratio-val").textContent = slider.value + ":1";
    if (state.mode === "general") renderPanel("blend");
  });
  const tgl = document.getElementById("tgl-frontier");
  tgl.addEventListener("click", () => {
    state.frontier = !state.frontier;
    tgl.classList.toggle("on", state.frontier);
    render();
  });
  for (const key of ["blend", "in", "out"]) {
    const chart = charts["chart-" + key];
    const pill = document.getElementById("reset-" + key);
    if (chart && pill) pill.addEventListener("click", () => resetZoom(chart, "chart-" + key));
  }
  window.addEventListener("resize", () => {
    for (const id of Object.keys(charts)) {
      if (charts[id].getDom().offsetParent !== null) charts[id].resize();
    }
  });
}

async function main() {
  try {
    const [c, m] = await Promise.all([
      fetch("./data/combined.json"),
      fetch("./data/meta.json"),
    ]);
    if (!c.ok || !m.ok) throw new Error("HTTP " + c.status + "/" + m.status);
    DATA = await c.json();
    META = await m.json();
  } catch (err) {
    document.querySelector("main").innerHTML =
      '<div style="padding:40px;color:#8b98ab">Failed to load data (' +
      err.message + "). Run <code>python3 update.py</code> and commit <code>public/data/</code>.</div>";
    return;
  }
  if (!window.echarts) {
    document.querySelector("main").innerHTML =
      '<div style="padding:40px;color:#8b98ab">ECharts failed to load from CDN — check your connection and reload.</div>';
    return;
  }
  ORG_COLOR = buildOrgColors(DATA);
  buildOfPanel();
  renderFooter();
  bindFilters();
  render();
}

main();
