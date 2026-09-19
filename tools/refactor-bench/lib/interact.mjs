// 029 A2/interactions: per-side CDP interaction benchmarks — chart init→paint,
// zoom wheel burst, drawer open/close, 2D→3D (GL cold + steady), longtask jank, memory.
// Instance-free: both apps (old global-echarts, new bundled-echarts) are probed via
// DOM + canvas signals only, so the comparison is fair across the refactor.
import { spawn } from "node:child_process";
import { serve } from "./serve.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INIT_SRC = `window.__navStart = performance.now();
window.__lt = { count: 0, tbt: 0 };
try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt.count++; window.__lt.tbt += Math.max(0, e.duration - 50); } }).observe({ type: 'longtask', buffered: true }); } catch (e) {}`;

const hashExpr = (id) => `(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  const cv = el && el.querySelector('canvas');
  if (!cv || !cv.width || !cv.height) return 'no';
  try { const ctx = cv.getContext('2d'); if (!ctx) return 'gl' + cv.width + 'x' + cv.height; const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 3; i < d.length; i += 4000) h = (h * 31 + d[i]) >>> 0; return '2d' + h; } catch (e) { return 'err'; }
})()`;

const METRIC_KEYS = ["initPaintMs", "zoomSettleMs", "zoomEvents", "drawerOpenMs", "drawerCloseMs", "cold3DMs", "steady3DMs", "jankCount", "jankTBTms", "memLoadKB", "memBurstKB", "memDeltaKB"];

function stats(values) {
  const v = values.filter((x) => x != null).slice().sort((a, b) => a - b);
  if (!v.length) return { median: null, p90: null, min: null, max: null };
  const median = v.length % 2 ? v[(v.length - 1) / 2] : Math.round((v[v.length / 2 - 1] + v[v.length / 2]) / 2);
  const p90 = v[Math.min(v.length - 1, Math.ceil(0.9 * v.length) - 1)];
  return { median, p90, min: v[0], max: v[v.length - 1] };
}
function aggregate(runs) {
  const out = { runs: runs.length };
  for (const k of METRIC_KEYS) out[k] = stats(runs.map((r) => r[k]));
  return out;
}

const SIDE_CFG = {
  old: { drawerVerify: `!!document.getElementById('details') && !document.getElementById('details').classList.contains('hidden') && (document.getElementById('details').innerText || '').length > 0`, drawerClose: `#details-x`, tgl3d: `#tgl-3d`, tglBack: `#tgl-3d` },
  new: { drawerVerify: `(() => { const d = document.querySelector('.drawer'); return !!d && (d.innerText || '').length > 0; })()`, drawerClose: `.drawer-x`, tgl3d: { cls: "button.pill", text: "3D" }, tglBack: { cls: "button.pill", text: "3D" } },
};

async function withChrome(cdpPort, fn) {
  const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", `--remote-debugging-port=${cdpPort}`, "--window-size=1400,900", "about:blank"], { stdio: "ignore" });
  const cleanup = () => { try { chrome.kill("SIGKILL"); } catch {} };
  let ws;
  try {
    let target;
    for (let i = 0; i < 60; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json`, { signal: AbortSignal.timeout(2000) })).json();
        target = list.find((t) => t.type === "page");
        if (target) break;
      } catch {}
      await sleep(300);
    }
    if (!target) throw new Error("no CDP target on port " + cdpPort);
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    await send("Page.enable");
    await send("Network.enable");
    await send("Runtime.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: INIT_SRC });
    return await fn(send);
  } finally {
    try { ws && ws.close(); } catch {}
    cleanup();
  }
}

async function waitReady(send, port) {
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  for (let i = 0; i < 150; i++) { await sleep(100); if (await ev(send, hashExpr("chart-blend")) !== "no") return true; }
  return false;
}
const ev = (send, expr) => send("Runtime.evaluate", { expression: expr, returnByValue: true }).then((m) => m.result?.result?.value);
const box = (send, sel) => ev(send, `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
async function centerOf(send, spec) {
  if (typeof spec === "string") return ev(send, `(() => { const e = document.querySelector(${JSON.stringify(spec)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  return ev(send, `(() => { const e = [...document.querySelectorAll(${JSON.stringify(spec.cls)})].find((x) => ${JSON.stringify(spec.text)} && x.textContent.includes(${JSON.stringify(spec.text)})); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
}
async function click(send, pt) {
  if (!pt) return false;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
  await sleep(120);
  return true;
}

async function openDrawer(send, cfg) {
  const b = await box(send, "#chart-blend");
  if (!b) return null;
  for (let gy = 0; gy < 10; gy++) {
    for (let gx = 0; gx < 14; gx++) {
      if (await ev(send, cfg.drawerVerify)) await click(send, await centerOf(send, cfg.drawerClose));
      const x = b.x + (b.w * (gx + 0.5)) / 14, y = b.y + (b.h * (gy + 0.5)) / 10;
      const t0 = Date.now();
      await click(send, { x, y });
      for (let i = 0; i < 16; i++) { await sleep(30); if (await ev(send, cfg.drawerVerify)) return Math.round(Date.now() - t0); }
    }
  }
  return null;
}
async function closeDrawer(send, cfg) {
  if (!(await ev(send, cfg.drawerVerify))) return 0;
  const t0 = Date.now();
  await click(send, await centerOf(send, cfg.drawerClose));
  for (let i = 0; i < 20; i++) { await sleep(30); if (!(await ev(send, cfg.drawerVerify))) return Math.round(Date.now() - t0); }
  return null;
}

async function measureSide(send, port, cfg, repeats) {
  const runs = [];
  for (let i = 0; i < repeats; i++) {
    await waitReady(send, port);
    const r = {};
    // 1. document-start → first chart paint (canvas hash flips from blank)
    const navStart = await ev(send, "window.__navStart");
    let paintAt = null;
    for (let i2 = 0; i2 < 120; i2++) { await sleep(50); if (await ev(send, hashExpr("chart-blend"))) { paintAt = await ev(send, "performance.now()"); break; } }
    r.initPaintMs = navStart != null && paintAt != null ? Math.round(paintAt - navStart) : null;
    r.memLoadKB = await ev(send, "(performance.memory && performance.memory.usedJSHeapSize) ? Math.round(performance.memory.usedJSHeapSize / 1024) : null");
    await ev(send, "window.__lt = { count: 0, tbt: 0 }");
    // 2. zoom wheel burst → settle (canvas hash changes after zoom)
    const cc = await ev(send, `(() => { const r = document.getElementById('chart-blend').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const before = await ev(send, hashExpr("chart-blend"));
    const K = 10;
    const tZoom0 = Date.now();
    for (let k = 0; k < K; k++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: cc.x, y: cc.y, deltaX: 0, deltaY: -120 }); await sleep(25); }
    let settled = false;
    for (let i2 = 0; i2 < 60; i2++) { await sleep(30); const h = await ev(send, hashExpr("chart-blend")); if (h !== before && h !== "no") { settled = true; break; } }
    r.zoomSettleMs = settled ? Math.round(Date.now() - tZoom0) : null;
    r.zoomEvents = K;
    // 3. drawer open (grid-scan) then close
    r.drawerOpenMs = await openDrawer(send, cfg);
    r.drawerCloseMs = await closeDrawer(send, cfg);
    // 4. 2D → 3D (cold GL load) then steady-state re-switch
    const t3a = Date.now();
    await click(send, await centerOf(send, cfg.tgl3d));
    let c3a = false;
    for (let i2 = 0; i2 < 80; i2++) { await sleep(50); if ((await ev(send, hashExpr("chart-3d"))) !== "no") { c3a = true; break; } }
    r.cold3DMs = c3a ? Math.round(Date.now() - t3a) : null;
    await click(send, await centerOf(send, cfg.tglBack));
    for (let i2 = 0; i2 < 40; i2++) { await sleep(50); if ((await ev(send, hashExpr("chart-3d"))) === "no") break; }
    const t3b = Date.now();
    await click(send, await centerOf(send, cfg.tgl3d));
    let c3b = false;
    for (let i2 = 0; i2 < 80; i2++) { await sleep(50); if ((await ev(send, hashExpr("chart-3d"))) !== "no") { c3b = true; break; } }
    r.steady3DMs = c3b ? Math.round(Date.now() - t3b) : null;
    // 5/6. jank + memory after the burst
    const lt = await ev(send, "window.__lt");
    r.jankCount = lt ? lt.count : null;
    r.jankTBTms = lt ? Math.round(lt.tbt) : null;
    r.memBurstKB = await ev(send, "(performance.memory && performance.memory.usedJSHeapSize) ? Math.round(performance.memory.usedJSHeapSize / 1024) : null");
    r.memDeltaKB = r.memLoadKB != null && r.memBurstKB != null ? r.memBurstKB - r.memLoadKB : null;
    runs.push(r);
  }
  return { config: cfg, ...aggregate(runs) };
}

export async function interactAnalysis(ctx) {
  const { ports, oldRoot, newRoot, refA, newLabel, repeats = 5 } = ctx;
  const servers = [];
  if (oldRoot) servers.push(await serve(oldRoot, ports.old));
  if (newRoot) servers.push(await serve(newRoot, ports.neu));
  const log = (...a) => console.log("[bench]  interact:", ...a);
  try {
    return await withChrome(ports.cdp, async (send) => {
      const out = {};
      if (oldRoot) { log(`old @ ${refA} (${repeats} repeats)…`); out.old = { label: `old @ ${refA}`, ...(await measureSide(send, ports.old, SIDE_CFG.old, repeats)) }; }
      if (newRoot) { log(`${newLabel} (${repeats} repeats)…`); out.new = { label: newLabel, ...(await measureSide(send, ports.neu, SIDE_CFG.new, repeats)) }; }
      return out;
    });
  } finally {
    for (const s of servers) s.close();
  }
}
