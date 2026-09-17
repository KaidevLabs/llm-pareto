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

// org -> logo filename in assets/logos/ (plan 007 D3/D8). Comes from
// meta.json (written by update.py from the logos.json registry), so a new
// org's logo needs no change here — the path is derived mechanically.
function logoFor(org) {
  const f = (META && META.logos || {})[org];
  return f ? "assets/logos/" + f : null;
}

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
  search: "",
  selected: null,
};
let DATA = [];
let META = null;
let ORG_COLOR = {};
let charts = {};
// Per-panel frontier arrays (plan 006 D3): the frontier line series carries
// no row references, so line clicks resolve through this stash — refreshed
// on every render, same lifetime as the chart instances themselves.
const FRONTIERS = {};

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

// Cleaned OpenRouter display name: parentheticals and the "Org: " prefix
// stripped. Shared by familyOf and the frontier point labels (plan 007 D5).
function displayName(d) {
  return (d.or_name || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/^[A-Za-z0-9 .&'-]+:\s*/, "")
    .trim();
}

function familyOf(d) {
  const body = displayName(d);
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

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function filtered() {
  let rows = DATA;
  if (state.families.size) rows = rows.filter((d) => state.families.has(orgOf(d) + "|" + familyOf(d)));
  if (state.vision === "vision") rows = rows.filter((d) => d.vision);
  return rows;
}

// Search match (plan 010 D2): case-insensitive substring over the
// OpenRouter name/id and the arena side — org, model, and the config
// variants collapsed into the point (arena_variants is a list). Stored
// lowercase; an empty query matches everything.
function searchHit(d) {
  const q = state.search;
  if (!q) return true;
  return (
    (d.or_name || "").toLowerCase().includes(q) ||
    (d.or_id || "").toLowerCase().includes(q) ||
    (d.arena_org || "").toLowerCase().includes(q) ||
    (d.arena_model || "").toLowerCase().includes(q) ||
    (d.arena_variants || []).join(" ").toLowerCase().includes(q)
  );
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

// Frontier badge (owner A/B 2026-09-16): the logo sits on a dark disc with
// an org-color ring, composited once per org at load. Compositing it into
// the symbol image means the hover glow (canvas shadow follows the drawn
// alpha) halos the disc — the bubble, not the logo.
const BADGE = {};

function compositeBadge(draw, color) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#0a0e16";
  x.beginPath();
  x.arc(128, 128, 112, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = color;
  x.lineWidth = 12;
  x.beginPath();
  x.arc(128, 128, 120, 0, Math.PI * 2);
  x.stroke();
  draw(x);
  return c.toDataURL();
}

function badgeFromImage(img, color) {
  return compositeBadge((x) => {
    const s = Math.min(150 / img.width, 150 / img.height);
    const w = img.width * s;
    const h = img.height * s;
    x.drawImage(img, 128 - w / 2, 128 - h / 2, w, h);
  }, color);
}

function fallbackBadge(org) {
  const letter = (org.trim()[0] || "?").toUpperCase();
  const color = ORG_COLOR[org] || ORG_FALLBACK;
  return compositeBadge((x) => {
    x.fillStyle = color;
    x.font = "600 110px Inter, sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(letter, 128, 136);
  }, color);
}

async function buildBadges() {
  const logos = (META && META.logos) || {};
  await Promise.all(
    Object.entries(logos).map(async ([org, file]) => {
      const img = await new Promise((res) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => res(null);
        i.src = "assets/logos/" + file;
      });
      // a failed load leaves no badge — the raw logo still renders (soft)
      BADGE[org] = img
        ? badgeFromImage(img, ORG_COLOR[org] || ORG_FALLBACK)
        : null;
    })
  );
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
    const lg = logoFor(orgOf(d));
    const parts = [
    '<div style="font-weight:600;font-size:13px">' +
      (lg
        ? '<img src="' +
          lg +
          '" width="18" height="18" style="vertical-align:-5px;margin-right:6px;border-radius:3px">'
        : "") +
      d.or_name +
      "</div>",
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
  // Per-panel frontier set (plan 007 D7): the "frontier" tag lives in the
  // scatter tooltip — the marker-less line has nothing to hover.
  const frontierSet = new Set(frontier.map((p) => p.d));
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
      // A pure line (plan 007 D1): logos and labels are the scatter's, the
      // line carries no symbols and no tooltip of its own.
      symbol: "none",
      lineStyle: {
        color: withAlpha(FRONTIER, 0.85),
        width: 2,
        shadowColor: withAlpha(FRONTIER, 0.55),
        shadowBlur: 14,
      },
      z: 6,
    });
  }

  series.push({
    name: "models",
    type: "scatter",
    // Frontier points render the org logo + a small permanent name label
    // (plan 007 D1/D5); everything else is a fixed 10px org-colored circle
    // (D4 — votes no longer encode in size, tooltip only).
    labelLayout: { moveOverlap: "shiftY" },
    data: pts.map((p) => {
      const d = p.d;
      const ov = d.match_method === "override";
      const color = ORG_COLOR[orgOf(d)] || ORG_FALLBACK;
      const org = orgOf(d);
      const isFrontier = frontierSet.has(d);
      const hit = searchHit(d);
      // Soft dim (plan 010 D1/D5): a search dims non-matching points only —
      // position, size, and org color are kept, the frontier stays bright.
      // Matches get a little emphasis on top (step-3 A/B, owner 2026-09-17):
      // circles get a full-alpha fill + a thin white ring; frontier badges
      // get the same as a white halo — a border on an image symbol strokes
      // its bounding box (5.6.0), the shadow follows the disc's alpha.
      const dim = !isFrontier && !hit;
      const hot = !isFrontier && state.search && hit;
      const hotF = isFrontier && state.search && hit;
      const logo = logoFor(org);
      return {
        value: p.value,
        d: d,
        // "image://" (two slashes) is the ECharts image-symbol prefix —
        // a single "image:" prefix falls through to a rect path and renders
        // nothing (verified 2026-09-16: the badge drew as an empty box)
        symbol: isFrontier
          ? BADGE[org]
            ? "image://" + BADGE[org]
            : logo
              ? "image://" + logo
              : "image://" + fallbackBadge(org)
          : "circle",
        symbolSize: isFrontier ? [24, 24] : 10,
        itemStyle: {
          color: isFrontier ? "rgba(0,0,0,0)" : withAlpha(color, dim ? 0.25 : hot ? 1 : 0.78),
          borderColor: ov ? OVERRIDE : isFrontier ? "rgba(0,0,0,0)" : hot ? "#e2e8f0" : dim ? withAlpha(color, 0.4) : withAlpha(color, 1),
          borderWidth: ov ? 2 : isFrontier ? 0 : hot ? 1.5 : 0.6,
          // no glow at rest — the owner wants a hard bubble; the glow is
          // the hover state (and the frontier line keeps its own). A
          // dimmed point keeps its fill but not the glow (010 D1); a
          // search-matched frontier badge is the only other glow, as the
          // white selection halo (step-3 A/B).
          shadowBlur: hotF ? 14 : !isFrontier && !dim && d.arena_rank <= 10 ? 10 : 0,
          shadowColor: hotF ? withAlpha("#e2e8f0", 0.9) : withAlpha(color, 0.5),
        },
        label: isFrontier
          ? {
              show: true,
              // per-data `label.text` is silently ignored in 5.6.0 — the
              // label fell back to the value formatter (price, elo); only
              // `formatter` renders the custom text (verified 2026-09-16).
              // Single tone: rich two-tone spans don't paint on 5.6.0 inner
              // text (chip paints, spans don't — repro'd; 6.1.0 paints) —
              // revisit only on an echarts upgrade.
              formatter: () =>
                (displayName(d) || org) +
                " (" +
                Math.round(d.arena_elo) +
                ")",
              position: "top",
              distance: 4,
              color: "#e2e8f0",
              fontSize: 9,
              fontWeight: 600,
              fontFamily: "Inter, system-ui, sans-serif",
              // label chip — hard box behind the text so it reads over the
              // line/points; org-tinted border ties it to its bubble. Sized
              // as a caption to the 24px badge (slim: tight line box,
              // x-padded, whisper of a border)
              backgroundColor: "#0a0e16",
              borderColor: withAlpha(color, 0.18),
              borderWidth: 1,
              borderRadius: 2,
              padding: [3, 8],
              lineHeight: 10,
            }
          : undefined,
        emphasis: {
          // Numeric scale = final-size ratio for scatter symbols (10→16, 24→32).
          scale: isFrontier ? 32 / 24 : 16 / 10,
          itemStyle: {
            color: isFrontier ? "rgba(0,0,0,0)" : withAlpha(color, 0.95),
            borderColor: ov ? OVERRIDE : hot ? "#e2e8f0" : withAlpha(color, 1),
            // the badge bakes its ring into the image — a square itemStyle
            // border around the badge would read as a box (5.6.0 image
            // symbols stroke their bounding box)
            borderWidth: ov ? 2 : isFrontier ? 0 : 1.5,
            shadowBlur: 18,
            shadowColor: hotF ? withAlpha("#e2e8f0", 1) : withAlpha(color, 0.65),
          },
        },
      };
    }),
    z: 7,
  });

  return {
    backgroundColor: "transparent",
    animationDuration: 450,
    // Gesture updates (wheel/drag/ratio slider) must be instant — the default
    // 300ms update animation makes continuous zoom/pan trail the cursor (D9).
    animationDurationUpdate: 0,
    grid: GRID,
    // Manual gesture model (D9, 018 A3/A4): native inside-dataZoom gestures
    // are off (the x/y mutex makes a native drag pan x only); wheel = 2D
    // zoom at cursor, drag = 2D pan, driven by batched dataZoom dispatches.
    // filterMode 'none' everywhere: the frontier line is only ever clipped,
    // never re-connected (A4).
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: 0,
        filterMode: "none",
        // Wheel is the 2D zoom in bindZoomChart, drag is the 2D pan in
        // bindPan — the native inside gestures would fight the other
        // dataZoom through ECharts' interaction mutex (a drag panned x
        // only, a wheel zoomed one axis only).
        zoomOnMouseWheel: false,
        moveOnMouseMove: false,
      },
      {
        type: "inside",
        yAxisIndex: 0,
        filterMode: "none",
        zoomOnMouseWheel: false,
        moveOnMouseMove: false,
      },
    ],
    tooltip: {
      backgroundColor: "rgba(10,14,23,0.94)",
      borderColor: "rgba(148,163,184,0.25)",
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      confine: true,
      formatter: (p) =>
        p.seriesName === "models"
          ? (frontierSet.has(p.data.d) ? "<b>frontier</b><br>" : "") +
            tooltipHTML(p.data)
          : p.tooltip,
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
  chart.dispatchAction({
    type: "dataZoom",
    dataZoomIndex: 0,
    // `batch` is the single-action form for multi-component updates — the
    // array form (dispatchAction([...])) is silently ignored (5.6.0)
    batch: [
      { dataZoomIndex: 0, start: 0, end: 100 },
      { dataZoomIndex: 1, start: 0, end: 100 },
    ],
  });
}

// Wheel zooms BOTH axes anchored at the cursor (owner A/B 2026-09-16;
// replaces the 018 A3 per-axis wheel — native inside-zoom can't do a
// 2D cursor-anchored zoom, so the gesture is manual on both windows).
// Zoom-out clamps at the fit bounds: the fit view is the widest window,
// axes never rescale behind the viewer (A1/A4).
function bindZoomChart(chart, id) {
  const dom = chart.getDom();
  // Capture phase: zrender's canvas listeners stopPropagation on wheel
  // (verified on 5.6.0), so a bubble listener on the chart div never sees
  // the event — capture on the div fires first.
  chart.on("datazoom", () => captureZoom(chart, id));
  const windows = () => {
    const o = chart.getOption();
    const fitx = o.xAxis[0];
    const fits = o.yAxis[0];
    const dz = o.dataZoom;
    const xz = dz.find((z) => z.xAxisIndex === 0);
    const yz = dz.find((z) => z.yAxisIndex === 0);
    return {
      fitx: { min: fitx.min, max: fitx.max },
      fits: { min: fits.min, max: fits.max },
      // dataZoom percents map LINEARLY across [min, max] even on the log
      // axis (verified against 5.6.0 dispatch behavior)
      Wmin: fitx.min + (fitx.max - fitx.min) * (xz.start / 100),
      Wmax: fitx.min + (fitx.max - fitx.min) * (xz.end / 100),
      Ymin: fits.min + (fits.max - fits.min) * (yz.start / 100),
      Ymax: fits.min + (fits.max - fits.min) * (yz.end / 100),
    };
  };
  dom.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const w = windows();
      const [p0, e0] = chart.convertFromPixel({
        seriesIndex: 0,
      }, [e.offsetX, e.offsetY]);
      const factor = e.deltaY < 0 ? 0.85 : 1.18;
      // x: zoom in log space, anchored at the cursor's price
      const lp = Math.log10(p0);
      let Wmin = Math.pow(10, lp + (Math.log10(w.Wmin) - lp) * factor);
      let Wmax = Math.pow(10, lp + (Math.log10(w.Wmax) - lp) * factor);
      // y: zoom in linear space, anchored at the cursor's elo
      let Ymin = e0 + (w.Ymin - e0) * factor;
      let Ymax = e0 + (w.Ymax - e0) * factor;
      Wmin = Math.max(Wmin, w.fitx.min);
      Wmax = Math.min(Wmax, w.fitx.max);
      Ymin = Math.max(Ymin, w.fits.min);
      Ymax = Math.min(Ymax, w.fits.max);
      if (Wmax <= Wmin || Ymax <= Ymin) return;
      // one batched action per event — two sequential dispatches double the
      // render work per wheel tick (D9)
      chart.dispatchAction({
        type: "dataZoom",
        dataZoomIndex: 0,
        batch: [
          { dataZoomIndex: 0, startValue: Wmin, endValue: Wmax },
          { dataZoomIndex: 1, startValue: Ymin, endValue: Ymax },
        ],
      });
    },
    { passive: false, capture: true }
  );
  dom.addEventListener("dblclick", () => resetZoom(chart, id));
}

// A pan ends with a synthetic click at the release point — ignore clicks
// shortly after a real drag so a pan never opens/closes the details drawer.
let lastPanEnd = 0;

// Click → details drawer (plan 006 D1/D3/D5): a bubble or a frontier
// segment selects its model, anything else (empty plot, axis) closes. The
// handlers live on the chart instance, so they survive the not-Merge
// setOption re-renders (D3). Empty plot areas never reach the ECharts-level
// "click" (no series hit) — only the zrender-level one fires, with no
// target — so the close-on-empty is bound there.
function onChartClick(id, p) {
  if (Date.now() - lastPanEnd < 300) return;
  if (p.seriesName === "models") {
    state.selected = p.data.d;
  } else if (p.seriesName === "Pareto frontier") {
    const fp = (FRONTIERS[id] || [])[p.dataIndex];
    if (!fp) return;
    state.selected = fp.d;
  } else {
    if (!state.selected) return;
    state.selected = null;
  }
  renderDetails();
}

function bindDrawerClose(chart) {
  chart.getZr().on("click", (e) => {
    if (e.target || Date.now() - lastPanEnd < 300) return;
    if (!state.selected) return;
    state.selected = null;
    renderDetails();
  });
}

// 2D pan (owner A/B 2026-09-16): a drag moves BOTH axis windows — zoom with
// the wheel (2D, bindZoomChart), then navigate with the cursor. The native
// inside drag only panned x (the two inside dataZooms fight for the gesture
// through ECharts' interaction mutex), so the gesture is manual: both
// windows are translated by the cursor delta and dispatched.
function bindPan(chart) {
  const dom = chart.getDom();
  let drag = null;
  dom.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const w = dom.clientWidth - GRID.left - GRID.right;
    const h = dom.clientHeight - GRID.top - GRID.bottom;
    if (
      e.offsetX < GRID.left ||
      e.offsetX > GRID.left + w ||
      e.offsetY < GRID.top ||
      e.offsetY > GRID.top + h
    )
      return;
    const fitx = chart.getOption().xAxis[0];
    const fits = chart.getOption().yAxis[0];
    const dz = chart.getOption().dataZoom;
    const xz = dz.find((z) => z.xAxisIndex === 0);
    const yz = dz.find((z) => z.yAxisIndex === 0);
    drag = {
      x0: e.clientX,
      y0: e.clientY,
      w,
      h,
      fitx: fitx.min,
      fitxMax: fitx.max,
      fits: fits.min,
      fitsMax: fits.max,
      // current window at gesture start; moves accumulate from this base
      // (percents map linearly across [min, max], even on the log axis)
      Wmin: fitx.min + (fitx.max - fitx.min) * (xz.start / 100),
      Wmax: fitx.min + (fitx.max - fitx.min) * (xz.end / 100),
      Ymin: fits.min + (fits.max - fits.min) * (yz.start / 100),
      Ymax: fits.min + (fits.max - fits.min) * (yz.end / 100),
    };
    dom.style.cursor = "grabbing";
    // the tooltip chasing the cursor under a panning view is pure churn
    // (a reposition per mousemove) — hide it for the gesture (D9)
    chart.setOption({ tooltip: { show: false } });
    e.preventDefault();
  });
  // Capture phase: zrender stops mousemove bubbling while a button is down
  // (verified on 5.6.0), so a window/bubble listener never sees the drag.
  dom.addEventListener(
    "mousemove",
    (e) => {
      if (!drag) return;
      const dpx = e.clientX - drag.x0;
      const dpy = e.clientY - drag.y0;
      // x: log window translates by the delta in log units
      const k = Math.pow(
        10,
        (-dpx / drag.w) * Math.log10(drag.Wmax / drag.Wmin)
      );
      let Wmin = drag.Wmin * k;
      let Wmax = drag.Wmax * k;
      // y: linear window translates by the delta in elo units
      const dy = (dpy / drag.h) * (drag.Ymax - drag.Ymin);
      let Ymin = drag.Ymin + dy;
      let Ymax = drag.Ymax + dy;
      // clamp to the fit bounds (the fit view is the widest window, 018 A4)
      Wmin = Math.max(Wmin, drag.fitx);
      Wmax = Math.min(Wmax, drag.fitxMax);
      Ymin = Math.max(Ymin, drag.fits);
      Ymax = Math.min(Ymax, drag.fitsMax);
      if (Wmax <= Wmin || Ymax <= Ymin) return;
      chart.dispatchAction({
        type: "dataZoom",
        dataZoomIndex: 0,
        batch: [
          { dataZoomIndex: 0, startValue: Wmin, endValue: Wmax },
          { dataZoomIndex: 1, startValue: Ymin, endValue: Ymax },
        ],
      });
      // Stamp on the move, not the mouseup: zrender fires the synthetic
      // click during the canvas mouseup, which runs before the window-level
      // mouseup handler — a flag set there would land after the click.
      if (
        Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 4
      )
        lastPanEnd = Date.now();
    },
    { capture: true }
  );
  window.addEventListener("mouseup", () => {
    if (!drag) return;
    drag = null;
    dom.style.cursor = "";
    chart.setOption({ tooltip: { show: true } });
  });
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
  FRONTIERS[id] = frontier;
  const el = document.getElementById(id);
  if (!charts[id]) {
    charts[id] = echarts.init(el, null, { renderer: "canvas" });
    bindZoomChart(charts[id], id);
    bindPan(charts[id]);
    charts[id].on("click", (p) => onChartClick(id, p));
    bindDrawerClose(charts[id]);
  }
  charts[id].setOption(
    chartOption(axisLabel, pts, frontier, spreadPts, bounds),
    true
  );

  // The zoom window survives the not-Merge setOption (018 A2).
  const z = ZOOM[id];
  if (z) {
    const batch = [];
    if (z.x)
      batch.push({
        dataZoomIndex: 0,
        start: z.x.start,
        end: z.x.end,
      });
    if (z.y)
      batch.push({ dataZoomIndex: 1, start: z.y.start, end: z.y.end });
    if (batch.length)
      charts[id].dispatchAction({
        type: "dataZoom",
        dataZoomIndex: 0,
        batch,
      });
  }

  document.getElementById("badge-" + panelKey).classList.toggle(
    "hidden",
    !state.frontier || frontier.length === 0
  );
  document.getElementById("count-" + panelKey).textContent =
    pts.length + " models" + (skipped ? " · " + skipped + " skipped (no price)" : "");
}

// "n/N" next to the search box (plan 010 D3): matches over the visible
// set — the 004 family/vision filters still apply. Rendered from render()
// so any filter change re-counts; hidden while the query is empty.
function updateSearchCount() {
  const el = document.getElementById("search-count");
  if (!el) return;
  if (!state.search) {
    el.textContent = "";
    el.classList.add("hidden");
    return;
  }
  const rows = filtered();
  el.textContent = rows.filter(searchHit).length + "/" + rows.length;
  el.classList.remove("hidden");
}

// Details drawer (plan 006): the content is the joined row — D2's v1 set,
// plus the derived OpenRouter page link and the "filtered out" state (D4).
// Rendered from render() too, so any filter change refreshes the indicator
// without touching the selection.
function detailsHTML(d, visible) {
  const org = orgOf(d);
  const ci =
    d.arena_elo_upper != null && d.arena_elo != null
      ? " (±" + Math.round(d.arena_elo_upper - d.arena_elo) + ")"
      : "";
  const match =
    d.match_method === "override"
      ? "⚑ manual override — identity fixed by owner decision, price final"
      : d.match_method +
        (d.match_ratio ? " (similarity " + d.match_ratio + ")" : "");
  const lg = logoFor(org);
  const row = (k, v, cls) =>
    '<div class="drow"><span class="k">' + k + "</span><span class=\"v" +
    (cls ? " " + cls : "") + "\">" + v + "</span></div>";
  const rows = [];
  if (!visible)
    rows.push('<div class="dfilter">⚠ filtered out — hidden by the current filters</div>');
  rows.push(
    row(
      "arena",
      "#" + d.arena_rank + " · elo " + d.arena_elo.toFixed(1) + ci +
        " · " + fmtVotes(d.arena_votes) + " votes"
    )
  );
  rows.push(
    row(
      "openrouter $/m",
      fmtPrice(d.price_in_per_m) + " in · " + fmtPrice(d.price_out_per_m) + " out"
    )
  );
  if (d.arena_price_in_per_m != null || d.arena_price_out_per_m != null)
    rows.push(
      row(
        "arena $/m (reported)",
        fmtPrice(d.arena_price_in_per_m) + " in · " +
          fmtPrice(d.arena_price_out_per_m) + " out",
        "dim"
      )
    );
  let ctx = fmtVotes(d.context_length);
  if (
    d.arena_context_length != null &&
    d.arena_context_length !== d.context_length
  )
    ctx += " · arena: " + fmtVotes(d.arena_context_length);
  rows.push(row("context", ctx));
  rows.push(
    row(
      "org",
      esc(org) +
        (d.arena_license ? " · " + esc(d.arena_license) : "") +
        (d.vision ? " · ✨ vision" : "")
    )
  );
  if (d.arena_variants && d.arena_variants.length)
    rows.push(row("variants", esc(d.arena_variants.join(" · "))));
  rows.push(row("match", esc(match), d.match_method === "override" ? "gold" : ""));
  const links = [
    '<a href="https://openrouter.ai/' + esc(d.or_id) + '" target="_blank" rel="noopener">OpenRouter page ↗</a>',
  ];
  if (d.arena_model_url)
    links.push(
      '<a href="' + esc(d.arena_model_url) + '" target="_blank" rel="noopener">arena model page ↗</a>'
    );
  return (
    '<div class="dhead">' +
    (lg
      ? '<img src="' + lg + '" width="20" height="20" alt="">'
      : "") +
    '<span class="dname">' + esc(d.or_name) + "</span>" +
    '<div class="did">' + esc(d.or_id) + "</div></div>" +
    rows.join("") +
    '<div class="dlinks">' + links.join("") + "</div>"
  );
}

function renderDetails() {
  const el = document.getElementById("details");
  const body = document.getElementById("details-body");
  if (!state.selected) {
    el.classList.add("hidden");
    body.innerHTML = "";
    return;
  }
  const d = state.selected;
  const visible = filtered().some((r) => r.or_id === d.or_id);
  body.innerHTML = detailsHTML(d, visible);
  el.classList.remove("hidden");
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
  updateSearchCount();
  if (state.mode === "general") renderPanel("blend");
  else if (state.mode === "in") renderPanel("in");
  else renderPanel("out");
  renderDetails();
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
    ovLine +
    '<br>Cookieless by design — no cookies. Just content.';
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
    const lg = logoFor(o);
    if (lg) {
      const img = document.createElement("img");
      img.src = lg;
      img.width = 16;
      img.height = 16;
      img.alt = "";
      img.style.borderRadius = "3px";
      org.appendChild(img);
    }
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
  // Search (plan 010): the box lands in index.html in step 2 — the guard
  // keeps this step's logic inert until it does.
  const searchBox = document.getElementById("search-box");
  if (searchBox)
    searchBox.addEventListener("input", () => {
      state.search = searchBox.value.trim().toLowerCase();
      render();
    });
  const tgl = document.getElementById("tgl-frontier");
  tgl.addEventListener("click", () => {
    state.frontier = !state.frontier;
    tgl.classList.toggle("on", state.frontier);
    render();
  });
  // Details drawer close (plan 006 D5): the × is static shell — bound once;
  // chart clicks and empty-area clicks go through onChartClick.
  document.getElementById("details-x").addEventListener("click", () => {
    state.selected = null;
    renderDetails();
  });
  for (const key of ["blend", "in", "out"]) {
    const pill = document.getElementById("reset-" + key);
    // The chart is lazy (first render of its mode), so look it up on click.
    if (pill)
      pill.addEventListener("click", () => {
        const c = charts["chart-" + key];
        if (c) resetZoom(c, "chart-" + key);
      });
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
  await buildBadges();
  buildOfPanel();
  renderFooter();
  bindFilters();
  render();
}

main();
