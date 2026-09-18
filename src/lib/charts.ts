// The imperative chart seam (028 A4): the echarts 5.6.0 option builders and
// interaction handlers ported from app.js — not-Merge setOption re-renders,
// the manual wheel-zoom/pan gesture model, the click→drawer seam, and the
// per-panel render functions. Svelte effects call into this module when the
// reactive state they read changes; the module owns the chart instances,
// zoom windows, frontier stashes, and the pan-click timestamp exactly as
// app.js did.
//
// echarts is the vendored global (classic <script> before the bundle).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { withAlpha, FRONTIER, OVERRIDE } from "./colors";
import { orgOf, displayName } from "./family";
import { fmtPrice, fmtVotes, fmtToks } from "./format";
import { filterRows, searchHit, blendedPrice } from "./filters";
import { paretoFrontier, paretoFrontier3D, fitLog, fitLinear, fitDecade } from "./pareto";
import { speedOf } from "./speed";
import type { Speed } from "./speed";
import { loadEchartsGL } from "./gl";
import { startTour, rafTicker, type Waypoint } from "./tour";
import { takeAutotour } from "./tourflag.svelte";
import { ui } from "./state.svelte";
import { data, logoFor } from "./data.svelte";
import { store } from "./endpoints.svelte";
import { panelStatus, type PanelKey } from "./panels.svelte";
import { badgeFor, fallbackBadge } from "./badges";
import type { Row } from "./types";

declare const echarts: any;

export type Pt = { value: number[]; d: Row; spd: Speed | null };
export type Bounds = { x?: object; y?: object };

// Chart grid insets (single source: axis geometry the y-strip wheel handler
// needs too) and per-panel zoom windows captured across re-renders (018 A2).
const GRID = { left: 58, right: 24, top: 26, bottom: 56 };
const charts: Record<string, any> = {};
const ZOOM: Record<string, { x?: { start: number; end: number }; y?: { start: number; end: number } }> = {};
// Per-panel frontier arrays (plan 006 D3): the frontier line series carries
// no row references, so line clicks resolve through this stash — refreshed
// on every render, same lifetime as the chart instances themselves.
const FRONTIERS: Record<string, Pt[]> = {};
// Per-panel crown points (027 step 2): the crowns series carries the row
// refs, this stash backs click resolution + the tour's naming.
const CROWNS: Record<string, Array<{ kind: "cheap" | "fast" | "elo"; label: string; p: Pt; center: [number, number, number] }>> = {};

export const X_SPEED = "output tok/s (p50, 30-min window, log)";
export const NOTE_PRICE = "wheel: zoom price + Elo (anchored at cursor) · drag: pan (both axes) · double-click or ⤢ fit: reset to full view · click a bubble or the frontier: model details · x: price $/M tokens, log scale (cheaper → left) — General blends in/out at the slider's ratio · y: LMArena Elo (higher = better) · color: organization · bar behind a point: its real price spread (blue = input → amber = output) · top-left = best of both";
export const NOTE_SPEED = "wheel: zoom speed + Elo (anchored at cursor) · drag: pan (both axes) · double-click or ⤢ fit: reset to full view · click a bubble or the frontier: model details · x: output tok/s, p50 across the model's serving endpoints, log scale (faster → right) · y: LMArena Elo (higher = better) · color: organization · top-right = best of both";
export const NOTE_3D = "drag: rotate · wheel: zoom · right-drag: pan · rotates slowly when idle · click a sphere: model details · x: price $/M blended at the slider's ratio (log, cheaper → left) · depth: output tok/s (log) · up: LMArena Elo (higher = better) · color: organization · glow = 3-objective Pareto frontier — nothing beats these on price, speed and quality";

function pointsFor(
  getPrice: (d: Row) => number | null,
  rows: Row[]
): { pts: Pt[]; skipped: number } {
  const pts: Pt[] = [];
  let skipped = 0;
  for (const d of rows) {
    const price = getPrice(d);
    if (price == null || d.arena_elo == null) {
      skipped++;
      continue;
    }
    // The hover card shows p50 speed in every view (owner A/B, 024 step 1):
    // the same 023 D2 aggregation as the speed axis — null until the
    // endpoints fetch settles, hidden then, same as the drawer.
    pts.push({ value: [price, d.arena_elo!], d, spd: speedOf(d.or_id, store.data) });
  }
  return { pts, skipped };
}

function tooltipHTML(p: Pt): string {
  const d = p.d;
  const ci =
    d.arena_elo_upper != null && d.arena_elo_lower != null
      ? " (±" + Math.round(d.arena_elo_upper - d.arena_elo!) + ")"
      : "";
  const match =
    d.match_method === "override"
      ? '<span style="color:' + OVERRIDE + '">⚑ manual override — identity fixed by owner decision, price final</span>'
      : "match: " + d.match_method + (d.match_ratio ? " (similarity " + d.match_ratio + ")" : "");
  const lg = logoFor(orgOf(d));
  // p50 speed in every view (023 D2/D6): the value plus its basis — the
  // median rule and the 30-min window are shown, not hidden. The 3D view
  // plots speed as its depth axis, so it carries the same lines. p.spd is
  // the render-time value (speed/3D builders); the live recompute keeps
  // the blend/price cards correct even before any post-fetch re-render.
  const spd = p.spd || speedOf(d.or_id, store.data);
  const rows = [
    '<div style="font-weight:600;font-size:13px">' +
      (lg
        ? '<img src="' +
          lg +
          '" width="18" height="18" style="vertical-align:-5px;margin-right:6px;border-radius:3px">'
        : "") +
      d.or_name +
      "</div>",
    '<div style="color:#8b98ab;font-size:11px;margin-top:1px">' + d.or_id + "</div>",
    '<div style="margin-top:6px">arena #' + d.arena_rank +
      ' · elo <span style="color:#34d399">' +
      d.arena_elo!.toFixed(1) +
      ci +
      "</span> · " +
      fmtVotes(d.arena_votes) +
      " votes</div>",
  ];
  if (spd) {
    rows.push(
      '<div style="margin-top:5px;color:#34d399;font-weight:600">' +
        fmtToks(spd.toks) +
        ' tok/s output p50 <span style="color:#8b98ab;font-weight:400">(30-min window)</span></div>',
      '<div style="color:#8b98ab;font-size:11px">median of ' + spd.n +
        (spd.n === 1 ? " endpoint" : " endpoints") + " · " +
        spd.rc.toLocaleString("en-US") + " requests" +
        (spd.latency != null
          ? " · latency p50 (ms) " + Math.round(spd.latency)
          : "") +
        "</div>"
    );
  }
  rows.push(
    '<div style="margin-top:6px">' +
      (ui.mode === "general"
        ? "<b>" + fmtPrice(blendedPrice(d, ui.ratio)) + "</b> blended (" + ui.ratio + ":1) · "
        : "") +
      '<span style="color:#60a5fa">' + fmtPrice(d.price_in_per_m) +
      "</span> in · <span style='color:#f59e0b'>" +
      fmtPrice(d.price_out_per_m) +
      "</span> out <span style='color:#8b98ab'>per M tokens</span></div>",
    "<div>" + orgOf(d) +
      (d.arena_license ? " · " + d.arena_license : "") +
      (d.context_length ? " · " + fmtVotes(d.context_length) + " ctx" : "") +
      (d.vision ? " · ✨ vision" : "") +
      "</div>",
    '<div style="margin-top:6px">' + match + "</div>",
  );
  return rows.join("");
}

function chartOption(
  label: string,
  pts: Pt[],
  frontier: Pt[],
  spreadPts: (number | null)[][] | null,
  bounds: Bounds,
  xFmt?: (v: number) => string
) {
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
      renderItem: (params: any, api: any) => {
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

  if (ui.frontier && frontier.length > 0) {
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
      const color = data.orgColor[orgOf(d)] || "#64748b";
      const org = orgOf(d);
      const isFrontier = frontierSet.has(d);
      const hit = searchHit(d, ui.search);
      // Soft dim (plan 010 D1/D5): a search dims non-matching points only —
      // position, size, and org color are kept, the frontier stays bright.
      // Matches get a little emphasis on top (step-3 A/B, owner 2026-09-17):
      // circles get a full-alpha fill + a thin white ring; frontier badges
      // get the same as a white halo — a border on an image symbol strokes
      // its bounding box (5.6.0), the shadow follows the disc's alpha.
      const dim = !isFrontier && !hit;
      const hot = !isFrontier && ui.search && hit;
      const hotF = isFrontier && ui.search && hit;
      const logo = logoFor(org);
      return {
        value: p.value,
        d: d,
        spd: p.spd,
        // "image://" (two slashes) is the ECharts image-symbol prefix —
        // a single "image:" prefix falls through to a rect path and renders
        // nothing (verified 2026-09-16: the badge drew as an empty box)
        symbol: isFrontier
          ? badgeFor(org)
            ? "image://" + badgeFor(org)
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
                Math.round(d.arena_elo!) +
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
      formatter: (p: any) =>
        p.seriesName === "models"
          ? (frontierSet.has(p.data.d)
              ? '<div style="font-weight:700;margin-bottom:4px">frontier</div>'
              : "") +
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
        // price panels format $; the speed panel passes its own tok/s
        // formatter (023 D6)
        formatter: xFmt || ((v: number) => (v >= 1 ? "$" + v : "$" + v.toFixed(2))),
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

function captureZoom(chart: any, id: string) {
  const dz = chart.getOption().dataZoom || [];
  const z: Record<string, { start: number; end: number }> = {};
  for (const d of dz) {
    if (d.xAxisIndex === 0) z.x = { start: d.start, end: d.end };
    if (d.yAxisIndex === 0) z.y = { start: d.start, end: d.end };
  }
  ZOOM[id] = z;
}

function resetZoom(chart: any, id: string) {
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
function bindZoomChart(chart: any, id: string) {
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
    const xz = dz.find((z: any) => z.xAxisIndex === 0);
    const yz = dz.find((z: any) => z.yAxisIndex === 0);
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
    (e: WheelEvent) => {
      e.preventDefault();
      const w = windows();
      const [p0, e0] = chart.convertFromPixel(
        { seriesIndex: 0 },
        [e.offsetX, e.offsetY]
      );
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
    { passive: false, capture: true } as AddEventListenerOptions
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
function onChartClick(id: string, p: any) {
  if (Date.now() - lastPanEnd < 300) return;
  if (p.seriesName === "models" || p.seriesName === "models-halo") {
    ui.selected = p.data.d;
  } else if (p.seriesName === "Pareto frontier") {
    const fp = (FRONTIERS[id] || [])[p.dataIndex];
    if (!fp) return;
    ui.selected = fp.d;
  } else if (p.seriesName === "crowns" || p.seriesName === "crowns-glyph" || p.seriesName === "crowns-name") {
    ui.selected = p.data.d;
  } else {
    if (!ui.selected) return;
    ui.selected = null;
  }
}

function bindDrawerClose(chart: any) {
  chart.getZr().on("click", (e: any) => {
    if (e.target || Date.now() - lastPanEnd < 300) return;
    if (!ui.selected) return;
    ui.selected = null;
  });
}

// 2D pan (owner A/B 2026-09-16): a drag moves BOTH axis windows — zoom with
// the wheel (2D, bindZoomChart), then navigate with the cursor. The native
// inside drag only panned x (the two inside dataZooms fight for the gesture
// through ECharts' interaction mutex), so the gesture is manual: both
// windows are translated by the cursor delta and dispatched.
function bindPan(chart: any) {
  const dom = chart.getDom();
  let drag: any = null;
  dom.addEventListener("mousedown", (e: MouseEvent) => {
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
    const xz = dz.find((z: any) => z.xAxisIndex === 0);
    const yz = dz.find((z: any) => z.yAxisIndex === 0);
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
    (e: MouseEvent) => {
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

// Chart lifecycle shared by every panel (023 step 2): lazy init on the
// panel's first active render (Chart2D passes its div) + the four
// interaction binds. Instances persist across mode switches; the zoom
// window restores after each not-Merge setOption (018 A2).
export function ensureChart2D(el: HTMLElement, id: string): any {
  if (!charts[id]) {
    charts[id] = echarts.init(el, null, { renderer: "canvas" });
    bindZoomChart(charts[id], id);
    bindPan(charts[id]);
    charts[id].on("click", (p: any) => onChartClick(id, p));
    bindDrawerClose(charts[id]);
  }
  return charts[id];
}

function restoreZoom(id: string) {
  const z = ZOOM[id];
  if (!z) return;
  const batch = [];
  if (z.x) batch.push({ dataZoomIndex: 0, start: z.x.start, end: z.x.end });
  if (z.y) batch.push({ dataZoomIndex: 1, start: z.y.start, end: z.y.end });
  if (batch.length)
    charts[id].dispatchAction({
      type: "dataZoom",
      dataZoomIndex: 0,
      batch,
    });
}

// ⤢ fit pill (live bindFilters): resets both zoom windows.
export function resetChart(id: string) {
  const c = charts[id];
  if (c) resetZoom(c, id);
}

export function renderPanel(el: HTMLElement, panelKey: Exclude<PanelKey, "speed" | "3d">) {
  const id = "chart-" + panelKey;
  const isBlend = panelKey === "blend";
  const priceKey = panelKey === "in" ? "price_in_per_m" : "price_out_per_m";
  const getPrice = isBlend
    ? (d: Row) => blendedPrice(d, ui.ratio)
    : (d: Row) => d[priceKey];
  const axisLabel = isBlend
    ? "$/M tokens · " + ui.ratio + ":1 in:out blend (log)"
    : "$/M " + (panelKey === "in" ? "input" : "output") + " tokens (log)";

  const rows = filterRows(data.rows, ui);
  const { pts, skipped } = pointsFor(getPrice, rows);
  const frontier = paretoFrontier(pts);
  const spreadPts: (number | null)[][] | null =
    isBlend && ui.spread
      ? pts.map((p) => [
          p.d.price_in_per_m,
          p.d.price_out_per_m,
          p.value[1],
        ])
      : null;

  // Axes are fitted to ALL joined data, not the filtered set (018 A1/A2):
  // they never move when a filter changes. With spread bars on, the blend
  // panel's x range also covers the real in/out prices the bars span.
  let xvals = pointsFor(getPrice, data.rows).pts.map((p) => p.value[0]);
  if (isBlend && ui.spread) {
    for (const d of data.rows) {
      if (d.price_in_per_m != null && d.price_in_per_m > 0) xvals.push(d.price_in_per_m);
      if (d.price_out_per_m != null && d.price_out_per_m > 0) xvals.push(d.price_out_per_m);
    }
  }
  const bounds = {
    x: fitLog(xvals) || undefined,
    y: fitLinear(data.rows.map((d) => d.arena_elo).filter((v): v is number => v != null)) || undefined,
  };

  FRONTIERS[id] = frontier;
  const chart = ensureChart2D(el, id);
  chart.setOption(
    chartOption(axisLabel, pts, frontier, spreadPts, bounds),
    true
  );

  // The zoom window survives the not-Merge setOption (018 A2).
  restoreZoom(id);

  panelStatus[panelKey].badgeHidden = !ui.frontier || frontier.length === 0;
  panelStatus[panelKey].count =
    pts.length + " models" + (skipped ? " · " + skipped + " skipped (no price)" : "");
}

// Speed view (023 step 2): x = per-model output speed (D2's median across
// the model's endpoints, log scale), y = arena Elo, the frontier is the
// per-view 2-D set over the plotted points with flipped x semantics (D3 —
// better is faster AND higher elo). Models without speed data are excluded
// from the plot and counted in the panel's status line (D4).
export function renderSpeedPanel(el: HTMLElement) {
  const id = "chart-speed";
  const status = panelStatus.speed;

  if (!store.done) {
    status.count = "loading speed data…";
    // the effect that called us reads store.done and re-runs on settle
    return;
  }

  if (!store.data) {
    // 404 or a failed fetch: an empty panel, the price views unaffected.
    status.count = store.error
      ? "speed data unavailable (" + store.error + ")"
      : "no speed data available";
    status.badgeHidden = true;
    if (charts[id]) charts[id].clear();
    FRONTIERS[id] = [];
    return;
  }

  const pts: Pt[] = [];
  let noElo = 0;
  let noSpeed = 0;
  for (const d of filterRows(data.rows, ui)) {
    if (d.arena_elo == null) {
      noElo++;
      continue;
    }
    const s = speedOf(d.or_id, store.data);
    if (!s) {
      noSpeed++;
      continue;
    }
    pts.push({ value: [s.toks, d.arena_elo!], d, spd: s });
  }
  const frontier = paretoFrontier(pts, true);

  // Axes fitted over ALL joined data, not the filtered set (018 A1/A2).
  const xvals: number[] = [];
  for (const d of data.rows) {
    const s = speedOf(d.or_id, store.data);
    if (s) xvals.push(s.toks);
  }
  const bounds = {
    x: fitLog(xvals) || undefined,
    y: fitLinear(data.rows.map((d) => d.arena_elo).filter((v): v is number => v != null)) || undefined,
  };

  FRONTIERS[id] = frontier;
  const chart = ensureChart2D(el, id);
  chart.setOption(
    chartOption(
      X_SPEED,
      pts,
      frontier,
      null,
      bounds,
      (v) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10))
    ),
    true
  );
  restoreZoom(id);

  status.badgeHidden = !ui.frontier || frontier.length === 0;
  status.count =
    pts.length + " models" +
    (noSpeed ? " · " + noSpeed + " without speed data hidden" : "") +
    (noElo ? " · " + noElo + " skipped (no elo)" : "");
}

// live render()'s post-render loop: visible charts follow the DOM size.
export function resizeVisibleCharts() {
  for (const id of Object.keys(charts)) {
    if (charts[id].getDom().offsetParent !== null) charts[id].resize();
  }
}

// ---- 3D showcase (023 D7–D9) --------------------------------------------
// A rotatable WebGL scene: x = blended price (log10), depth = output speed
// (log10), up = arena Elo — the 2D chart's axes plus speed. Values are
// pre-transformed (log10 on linear 3D axes), so whole-decade ticks read as
// $1 / $10 / $100. The frontier is the 3-objective non-dominated set,
// rendered as glowing spheres (a 3D Pareto set is a surface, not a chain —
// D8). echarts-gl's viewControl owns the camera (drag rotate / wheel zoom /
// right-drag pan, slow auto-rotate after idle) — the 2D pan/zoom layer is
// NOT bound here (D9). Filtered models missing any axis are excluded
// (D4 semantics). Panel chrome (badge/count) travels through panelStatus;
// the stale-state guard (`if (!ui.three3d) return`) covers leaving while
// the lazy GL script loads.

export function render3DPanel(el: HTMLElement) {
  const id = "chart-3d";
  const status = panelStatus["3d"];
  if (!store.done) {
    status.count = "loading speed data…";
    // the calling effect reads store.done and re-runs on settle
    return;
  }

  // Scene prep runs SYNCHRONOUSLY so every reactive read (frontier, ratio,
  // search, families, endpoints, rows) is tracked by the calling effect —
  // reads inside the GL-load callback would be invisible to it.
  const scene = build3DScene(id, status);
  loadEchartsGL().then((glOk) => {
    if (!ui.three3d) return; // the user left while loading
    if (!glOk) {
      status.count = "3D unavailable (failed to load echarts-gl)";
      status.badgeHidden = true;
      return;
    }
    if (!charts[id]) {
      // echarts-gl must register BEFORE the chart instance is created
      // (#468); the cached promise makes this free after the first entry.
      charts[id] = echarts.init(el, null, { renderer: "canvas" });
      charts[id].on("click", (p: any) => onChartClick(id, p));
      bindDrawerClose(charts[id]);
    }
    charts[id].setOption(scene.option, true);
    // `tour=1` autostart (027 A3): the flag is consumed HERE — the first
    // moment the chart instance actually exists (the Panel's effect runs
    // before the async GL load, so an earlier consume would race it).
    if (takeAutotour()) startTour3D();
  });
}

// ---- guided tour (027 step 2) ---------------------------------------------
// The tour drives the camera through chart.setOption merge pushes (tour.ts);
// the scene's own render path is untouched. Any real pointer/wheel gesture
// on the chart host cancels the flight (A2's "the hand wins" rule) — bound
// once per tour start on the instance's zr layer, which also sees the 3D
// rotate drags. While the flight runs it pushes viewControl every frame,
// which keeps resetting echarts-gl's autoRotate still-timer — the idle
// rotation never fights the tour (verified by probe 2026-09-18).
//
// The Panel registers caption/state callbacks (registerTourUi); the tour's
// lifecycle lives here so the pill click and the `tour=1` autostart take
// the exact same path.

let tourStop: (() => void) | null = null;
let tourUi: { onCaption(s: string): void; onState(running: boolean): void } | null = null;

export function registerTourUi(h: { onCaption(s: string): void; onState(running: boolean): void }) {
  tourUi = h;
}

export function tourRunning(): boolean {
  return tourStop !== null;
}

// Start the guided tour on the chart-3d instance. Returns false when the
// 3D chart isn't ready (GL still loading / already touring).
export function startTour3D(): boolean {
  const chart = charts["chart-3d"];
  if (!chart || tourStop) return false;
  const tour = startTour(chart, {
    waypoints: tourScript(),
    ticker: rafTicker(),
    segmentMs: 2600, // slower glide, longer holds (owner A/B)
    onCaption: (s) => tourUi?.onCaption(s),
    onDone: () => teardown(),
  });
  const teardown = () => {
    if (!tourStop) return;
    tourStop = null;
    zrOff(chart, cancel);
    tour.cancel();
    tourUi?.onState(false);
    tourUi?.onCaption("");
  };
  const cancel = () => teardown();
  chart.getZr().on("mousedown", cancel);
  chart.getZr().on("wheel", cancel);
  chart.getZr().on("touchstart", cancel);
  tourStop = teardown;
  tourUi?.onState(true);
  return true;
}

function zrOff(chart: any, fn: () => void) {
  chart.getZr().off("mousedown", fn);
  chart.getZr().off("wheel", fn);
  chart.getZr().off("touchstart", fn);
}

export function stopTour3D() {
  if (tourStop) tourStop();
}

// The tour script (A2: owner edits the copy at review). Camera choreography
// per the owner's 2026-09-18 A/B: start wide → full lateral (Elo vs price
// plane, alpha ~0) diving to the cheapest → full top-down (speed vs price
// plane, alpha ~90) diving to the fastest → lateral again diving to the
// smartest → finish at a 45° angle framing the whole cloud. Each stop's
// camera CENTER rides on the crown's actual point (viewControl.center,
// verified in the echarts-gl 2.1.0 minified source: merge setOption
// handles center); the finale recenters on the box midpoint. Fine-tuned
// by owner A/B. Captions name the crowned models live (the `{crown}`
// slot expands at startTour time from the scene's CROWNS).
type CenterSlot = "cheap" | "fast" | "elo" | "mid";
interface TourStop extends Omit<Waypoint, "center"> {
  centerSlot: CenterSlot;
}
const TOUR_WAYPOINTS: TourStop[] = [
  { alpha: 20, beta: 25, distance: 330, centerSlot: "mid", caption: "every frontier model — price, speed and quality at once", hold: 3200 },
  { alpha: 2, beta: 0, distance: 85, centerSlot: "cheap", caption: "the price floor: {crown.cheap}", hold: 3600 },
  { alpha: 88, beta: 0, distance: 85, centerSlot: "fast", caption: "the speed ceiling: {crown.fast}", hold: 3600 },
  { alpha: 2, beta: 0, distance: 85, centerSlot: "elo", caption: "the intelligence peak: {crown.elo}", hold: 3600 },
  { alpha: 35, beta: 45, distance: 150, centerSlot: "mid", caption: "the glow — the 3-objective Pareto frontier", hold: 4000 },
];

// The box center in world units is the origin — the default camera target;
// the finale returns to it.
const SCENE_MID: [number, number, number] = [0, 0, 0];

// Resolve the waypoints' symbolic center slots + {crown} caption slots
// against the live scene (called at tour start; CROWNS is populated).
function tourScript(): Waypoint[] {
  const resolve = (slot: CenterSlot): [number, number, number] => {
    if (slot === "mid") return SCENE_MID;
    const rec = (CROWNS["chart-3d"] || []).find((c) => c.kind === slot);
    return rec ? rec.center : SCENE_MID;
  };
  const crownName = (kind: "cheap" | "fast" | "elo"): string => {
    const rec = (CROWNS["chart-3d"] || []).find((c) => c.kind === kind);
    if (!rec) return "";
    return (displayName(rec.p.d) || orgOf(rec.p.d)) + " — " + rec.label;
  };
  return TOUR_WAYPOINTS.map((w) => ({
    alpha: w.alpha,
    beta: w.beta,
    distance: w.distance,
    center: resolve(w.centerSlot),
    caption: w.caption
      .replace("{crown.cheap}", crownName("cheap"))
      .replace("{crown.fast}", crownName("fast"))
      .replace("{crown.elo}", crownName("elo")),
    hold: w.hold,
  }));
}

function build3DScene(id: string, status: { count: string; badgeHidden: boolean }): { option: any } {
  const pts: Pt[] = [];
  let noAxis = 0;
  let noSpeed = 0;
  for (const d of filterRows(data.rows, ui)) {
    const price = blendedPrice(d, ui.ratio);
    const s = speedOf(d.or_id, store.data);
    if (d.arena_elo == null || price == null || price <= 0) {
      noAxis++;
      continue;
    }
    if (!s) {
      noSpeed++;
      continue;
    }
    pts.push({
      value: [Math.log10(price), Math.log10(s.toks), d.arena_elo!],
      d,
      spd: s,
    });
  }
  const frontier = ui.frontier ? paretoFrontier3D(pts) : [];
  const frontierSet = new Set(frontier.map((p) => p.d));
  FRONTIERS[id] = frontier;

  // The crowns (027 step 2, owner pick "3D crowns + tour naming"): the
  // cheapest / fastest / highest-Elo model of the PLOTTED set. One model
  // may hold several crowns — one crown marker per CROWN, not per model.
  const crownSpec: Array<{ kind: "cheap" | "fast" | "elo"; label: string; color: string }> = [
    { kind: "cheap", label: "$ champion", color: "#f59e0b" },
    { kind: "fast", label: "speed champion", color: "#60a5fa" },
    { kind: "elo", label: "Elo king", color: "#34d399" },
  ];
  const best = (k: "cheap" | "fast" | "elo"): Pt | null => {
    let b: Pt | null = null;
    for (const p of pts) {
      if (
        !b ||
        (k === "cheap" && p.value[0] < b.value[0]) ||
        (k === "fast" && p.value[1] > b.value[1]) ||
        (k === "elo" && p.value[2] > b.value[2])
      )
        b = p;
    }
    return b;
  };
  const crowns = crownSpec
    .map((c) => ({ ...c, p: best(c.kind) }))
    .filter((c) => c.p !== null) as Array<{ kind: "cheap" | "fast" | "elo"; label: string; color: string; p: Pt }>;

  // Axes fit over ALL joined data, not the filtered set (018 A1/A2).
  const logPrices: number[] = [];
  const logSpeeds: number[] = [];
  const elos: number[] = [];
  for (const d of data.rows) {
    const price = blendedPrice(d, ui.ratio);
    const s = speedOf(d.or_id, store.data);
    if (d.arena_elo == null || price == null || price <= 0 || !s) continue;
    logPrices.push(Math.log10(price));
    logSpeeds.push(Math.log10(s.toks));
    elos.push(d.arena_elo!);
  }
  const bounds = {
    x: fitDecade(logPrices) || undefined,
    y: fitDecade(logSpeeds) || undefined,
    z: fitLinear(elos) || undefined,
  };
  // viewControl.center is in GL WORLD units, origin at the box center —
  // grid3DCreator sets the axis coord extents to x [-W/2,+W/2], depth
  // y [+D/2,-D/2] (REVERSED — faster models sit at negative depth),
  // height z [-H/2,+H/2]; dataToCoord maps normalized data linearly into
  // the extent. Box: 150 × 120 × 110 (the grid3D block below).
  const toWorld = (dx: number, dy: number, dz: number): [number, number, number] => {
    const bx = bounds.x!;
    const by = bounds.y!;
    const bz = bounds.z!;
    return [
      ((dx - bx.min) / (bx.max - bx.min)) * 150 - 75,
      ((dz - bz.min) / (bz.max - bz.min)) * 110 - 55,
      60 - ((dy - by.min) / (by.max - by.min)) * 120,
    ];
  };
  CROWNS[id] = crowns.map(({ kind, label, p }) => ({
    kind,
    label,
    p,
    center: toWorld(p.value[0], p.value[1], p.value[2]),
  }));

  const orgCol = (p: Pt) => data.orgColor[orgOf(p.d)] || "#64748b";
  const ov = (p: Pt) => p.d.match_method === "override";
  const sphere = (p: Pt, alpha: number) => ({
    value: p.value,
    d: p.d,
    spd: p.spd,
    itemStyle: {
      color: withAlpha(orgCol(p), alpha),
      borderColor: ov(p) ? OVERRIDE : "rgba(0,0,0,0)",
      borderWidth: ov(p) ? 2 : 0,
    },
  });
  const mat = (p: Pt) => sphere(p, !searchHit(p.d, ui.search) && ui.search ? 0.25 : 0.75);

  const series = [];
  if (frontier.length) {
    // the glow (D8): a larger, translucent twin sphere behind each
    // frontier point — WebGL has no shadowBlur, so the halo is geometry
    series.push({
      name: "models-halo",
      type: "scatter3D",
      data: frontier.map((p) => ({
        value: p.value,
        d: p.d,
        spd: p.spd,
        itemStyle: { color: orgCol(p), opacity: 0.16 },
      })),
      symbolSize: 22,
    });
  }
  series.push({
    name: "models",
    type: "scatter3D",
    data: pts.map((p) => (frontierSet.has(p.d) ? sphere(p, 1) : mat(p))),
    symbolSize: (val: any, params: any) =>
      frontierSet.has(params.data.d) ? 12 : 7,
    label: {
      show: true,
      // sparse (D9): frontier points only — non-frontier labels format to
      // nothing; hover identifies the rest via the tooltip
      formatter: (p: any) =>
        frontierSet.has(p.data.d)
          ? (displayName(p.data.d) || orgOf(p.data.d)) +
            " (" + Math.round(p.data.d.arena_elo) + ")"
          : "",
      distance: 2,
      textStyle: { color: "#e2e8f0", fontSize: 9, fontWeight: 600 },
    },
  });

  if (crowns.length) {
    // Crown chrome per crowned point, three plain-label series (GL labels
    // are plain text only). GL lessons (found 2026-09-18): symbols are
    // sphere MESHES — borderColor/borderWidth don't render, so the marker
    // is a translucent solid sphere (the #468 halo pattern); and
    // `opacity: 0` culls the point's LABEL too — label carriers must keep
    // default opacity with a transparent color.
    series.push({
      name: "crowns",
      type: "scatter3D",
      data: crowns.map((c) => ({
        value: c.p.value,
        d: c.p.d,
        spd: c.p.spd,
        crown: c.label,
        itemStyle: { color: withAlpha(c.color, 0.3) },
      })),
      symbolSize: 26,
    });
    series.push({
      name: "crowns-glyph",
      type: "scatter3D",
      data: crowns.map((c) => ({
        value: c.p.value,
        d: c.p.d,
        spd: c.p.spd,
        crown: c.label,
        itemStyle: { color: "rgba(0,0,0,0)" },
      })),
      symbolSize: 0.1,
      label: {
        show: true,
        formatter: () => "♛",
        distance: 14,
        textStyle: { color: "#ffd166", fontSize: 26, fontWeight: 700 },
      },
    });
    series.push({
      name: "crowns-name",
      type: "scatter3D",
      data: crowns.map((c) => ({
        value: c.p.value,
        d: c.p.d,
        spd: c.p.spd,
        crown: c.label,
        itemStyle: { color: "rgba(0,0,0,0)" },
      })),
      symbolSize: 0.1,
      label: {
        show: true,
        formatter: (p: any) => p.data.crown,
        distance: 40,
        textStyle: { color: "#e2e8f0", fontSize: 11, fontWeight: 700 },
      },
    });
  }

  const option = {
      backgroundColor: "transparent",
      animationDuration: 450,
      animationDurationUpdate: 0,
      tooltip: {
        backgroundColor: "rgba(10,14,23,0.94)",
        borderColor: "rgba(148,163,184,0.25)",
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        confine: true,
        formatter: (p: any) =>
          p.seriesName === "models" || p.seriesName === "models-halo"
            ? (frontierSet.has(p.data.d)
                ? '<div style="font-weight:700;margin-bottom:4px">frontier</div>'
                : "") +
              tooltipHTML(p.data)
            : p.seriesName.startsWith("crowns")
            ? '<div style="font-weight:700;margin-bottom:4px">♛ ' + p.data.crown + "</div>" + tooltipHTML(p.data)
            : "",
      },
      grid3D: {
        boxWidth: 150,
        boxDepth: 120,
        boxHeight: 110,
        viewControl: {
          // slow auto-rotate only after 4s idle (D9): the scene is alive
          // while untouched, never fights the user's hand
          autoRotate: false,
          autoRotateAfterStill: 4,
          autoRotateSpeed: 0.5,
          distance: 230,
          minDistance: 60,
          maxDistance: 500,
        },
        light: {
          main: { intensity: 1.4, shadow: false },
          ambient: { intensity: 0.5 },
        },
        axisLine: { lineStyle: { color: "rgba(148,163,184,0.35)" } },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.07)" } },
      },
      xAxis3D: {
        type: "value",
        name: "price $/M (log)",
        ...(bounds.x || {}),
        nameTextStyle: { color: "#8b98ab", fontSize: 10 },
        axisLabel: {
          color: "#8b98ab",
          fontSize: 10,
          formatter: (v: number) =>
            v >= 1 ? "$" + Math.round(Math.pow(10, v)) : "$" + Math.pow(10, v).toFixed(2),
        },
      },
      yAxis3D: {
        type: "value",
        name: "output tok/s (log)",
        ...(bounds.y || {}),
        nameTextStyle: { color: "#8b98ab", fontSize: 10 },
        axisLabel: {
          color: "#8b98ab",
          fontSize: 10,
          formatter: (v: number) => String(Math.round(Math.pow(10, v))),
        },
      },
      zAxis3D: {
        type: "value",
        name: "Arena Elo",
        ...(bounds.z || {}),
        nameTextStyle: { color: "#8b98ab", fontSize: 10 },
        axisLabel: { color: "#8b98ab", fontSize: 10 },
      },
      series,
  };

  status.badgeHidden = !ui.frontier || frontier.length === 0;
  status.count =
    pts.length + " models" +
    (frontier.length ? " · " + frontier.length + " on the frontier" : "") +
    (noSpeed ? " · " + noSpeed + " without speed data hidden" : "") +
    (noAxis ? " · " + noAxis + " skipped (no price/elo)" : "");

  return { option };
}
