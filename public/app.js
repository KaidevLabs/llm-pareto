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

const state = { mode: "general", vision: "all", frontier: true };
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
  if (state.vision !== "vision") return DATA;
  return DATA.filter((d) => d.vision);
}

function pointsFor(priceKey, rows) {
  const pts = [];
  let skipped = 0;
  for (const d of rows) {
    if (d[priceKey] == null || d.arena_elo == null) {
      skipped++;
      continue;
    }
    pts.push({ value: [d.arena_elo, d[priceKey]], d });
  }
  return { pts, skipped };
}

// Pareto frontier: no other point has both >= elo and <= price.
function paretoFrontier(pts) {
  const out = [];
  for (const p of pts) {
    let dominated = false;
    for (const q of pts) {
      if (q === p) continue;
      if (
        q.value[0] >= p.value[0] &&
        q.value[1] <= p.value[1] &&
        (q.value[0] > p.value[0] || q.value[1] < p.value[1])
      ) {
        dominated = true;
        break;
      }
    }
    if (!dominated) out.push(p);
  }
  out.sort((a, b) => b.value[0] - a.value[0]);
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

function chartOption(label, pts, frontier) {
  const votes = pts.map((p) => p.d.arena_votes || 1);
  const lo = Math.min.apply(null, votes);
  const hi = Math.max.apply(null, votes);
  const series = [];

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
    grid: { left: 64, right: 24, top: 26, bottom: 46 },
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
      type: "value",
      name: "Arena Elo",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: { color: "#8b98ab", fontSize: 11 },
      axisLine: { show: true, lineStyle: { color: "rgba(148,163,184,0.25)" } },
      axisLabel: { color: "#8b98ab", fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.07)" } },
    },
    yAxis: {
      type: "log",
      name: label,
      nameLocation: "middle",
      nameGap: 48,
      nameTextStyle: { color: "#8b98ab", fontSize: 11 },
      axisLine: { show: true, lineStyle: { color: "rgba(148,163,184,0.25)" } },
      axisLabel: {
        color: "#8b98ab",
        fontSize: 11,
        formatter: (v) => (v >= 1 ? "$" + v : "$" + v.toFixed(2)),
      },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.07)" } },
    },
    series,
  };
}

function renderPanel(id, priceKey, axisLabel) {
  const rows = filtered();
  const { pts, skipped } = pointsFor(priceKey, rows);
  const frontier = paretoFrontier(pts);
  const key = id.split("-")[1];

  const el = document.getElementById(id);
  if (!charts[id]) {
    charts[id] = echarts.init(el, null, { renderer: "canvas" });
  }
  charts[id].setOption(
    chartOption(axisLabel, pts, frontier),
    true
  );

  document.getElementById("badge-" + key).classList.toggle(
    "hidden",
    !state.frontier || frontier.length === 0
  );
  document.getElementById("count-" + key).textContent =
    pts.length + " models" + (skipped ? " · " + skipped + " skipped (no price)" : "");
}

function render() {
  const main = document.getElementById("main");
  main.setAttribute("data-mode", state.mode);
  if (state.mode === "general" || state.mode === "in") {
    renderPanel("chart-in", "price_in_per_m", "$/M input tokens");
  }
  if (state.mode === "general" || state.mode === "out") {
    renderPanel("chart-out", "price_out_per_m", "$/M output tokens");
  }
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
  const tgl = document.getElementById("tgl-frontier");
  tgl.addEventListener("click", () => {
    state.frontier = !state.frontier;
    tgl.classList.toggle("on", state.frontier);
    render();
  });
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
  renderFooter();
  bindFilters();
  render();
}

main();
