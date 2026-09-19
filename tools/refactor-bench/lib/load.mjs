// 029 A2/load: CDP headless load timing — N runs, cold/warm × unthrottled/throttled, LCP, waterfall, --live.
import { spawn } from "node:child_process";
import { serve } from "./serve.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FAST3G = { offline: false, latency: 562, downloadThroughput: 180000, uploadThroughput: 93750 };
const NO_NETWORK = { offline: false, latency: 0, downloadThroughput: 0, uploadThroughput: 0 };
const LCP_SOURCE = `window.__lcp = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}`;
const CHART_EXPR = `!!(window.echarts && document.getElementById("chart-blend") && echarts.getInstanceByDom(document.getElementById("chart-blend")) && (echarts.getInstanceByDom(document.getElementById("chart-blend")).getOption().series || []).some((s) => s && s.data && s.data.length))`;
const METRICS_EXPR = `(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');
  const fcp = paint.find((p) => p.name === 'first-contentful-paint');
  const res = performance.getEntriesByType('resource');
  const t = (k) => (nav[k] || 0) + res.reduce((s, r) => s + (r[k] || 0), 0);
  return {
    ttfbMs: nav ? Math.round(nav.responseStart) : null,
    dclMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    loadMs: nav ? Math.round(nav.loadEventEnd) : null,
    fcpMs: fcp ? Math.round(fcp.startTime) : null,
    lcpMs: window.__lcp ? Math.round(window.__lcp) : null,
    requests: 1 + res.length,
    transferKB: Math.round(t('transferSize') / 1024),
    encodedKB: Math.round(t('encodedBodySize') / 1024),
    decodedKB: Math.round(t('decodedBodySize') / 1024),
  };
})()`;
const WF_EXPR = `(() => performance.getEntriesByType('resource').map((r) => ({ url: r.name, transferKB: Math.round((r.transferSize || 0) / 1024), encodedKB: Math.round((r.encodedBodySize || 0) / 1024), durationMs: Math.round(r.duration) })))()`;

const METRIC_KEYS = ["ttfbMs", "dclMs", "loadMs", "fcpMs", "lcpMs", "chartMs", "requests", "transferKB", "encodedKB", "decodedKB"];

function stats(values) {
  const v = values.filter((x) => x != null).slice().sort((a, b) => a - b);
  if (!v.length) return { median: null, p90: null, min: null, max: null };
  const median = v.length % 2 ? v[(v.length - 1) / 2] : Math.round((v[v.length / 2 - 1] + v[v.length / 2]) / 2);
  const p90 = v[Math.min(v.length - 1, Math.ceil(0.9 * v.length) - 1)];
  return { median, p90, min: v[0], max: v[v.length - 1] };
}

function aggregate(runs) {
  const out = {};
  for (const k of METRIC_KEYS) out[k] = stats(runs.map((r) => r[k]));
  return { runs: runs.length, ...out };
}

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
    await send("Emulation.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: LCP_SOURCE });
    return await fn(send);
  } finally {
    try { ws && ws.close(); } catch {}
    cleanup();
  }
}

async function measure(send, port) {
  const t0 = performance.now();
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  let chartMs = null;
  for (let i = 0; i < 150; i++) {
    await sleep(100);
    const has = await send("Runtime.evaluate", { expression: CHART_EXPR, returnByValue: true });
    if (has.result?.result?.value) { chartMs = Math.round(performance.now() - t0); break; }
  }
  await sleep(300);
  const m = (await send("Runtime.evaluate", { expression: METRICS_EXPR, returnByValue: true })).result?.result?.value;
  m.chartMs = chartMs;
  return m;
}

async function waterfall(send, port) {
  const t0 = performance.now();
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  for (let i = 0; i < 150; i++) {
    await sleep(100);
    const has = await send("Runtime.evaluate", { expression: CHART_EXPR, returnByValue: true });
    if (has.result?.result?.value) break;
  }
  await sleep(300);
  const wf = (await send("Runtime.evaluate", { expression: WF_EXPR, returnByValue: true })).result?.result?.value || [];
  return wf
    .map((r) => ({ ...r, url: r.url.replace(/^https?:\/\/[^/]+\//, "/").split("?")[0] }))
    .sort((a, b) => b.transferKB - a.transferKB)
    .slice(0, 25);
}

async function measureSide(send, port, runs) {
  const conditions = {};
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Network.emulateNetworkConditions", NO_NETWORK);
  await send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const wf = await waterfall(send, port);
  const runCond = async (name, cacheDisabled, throttle) => {
    await send("Network.setCacheDisabled", { cacheDisabled });
    if (throttle) {
      await send("Network.emulateNetworkConditions", FAST3G);
      await send("Emulation.setCPUThrottlingRate", { rate: 4 });
    } else {
      await send("Network.emulateNetworkConditions", NO_NETWORK);
      await send("Emulation.setCPUThrottlingRate", { rate: 1 });
    }
    const runsArr = [];
    for (let i = 0; i < runs; i++) runsArr.push(await measure(send, port));
    return aggregate(runsArr);
  };
  conditions["cold-unthrottled"] = await runCond("cold-unthrottled", true, false);
  conditions["cold-throttled"] = await runCond("cold-throttled", true, true);
  await send("Network.setCacheDisabled", { cacheDisabled: false });
  await measure(send, port);
  conditions["warm-unthrottled"] = await runCond("warm-unthrottled", false, false);
  conditions["warm-throttled"] = await runCond("warm-throttled", false, true);
  return { conditions, waterfall: wf };
}

async function measureLive(send, runs) {
  const url = "https://llm-pareto.kaidev.io/";
  const conditions = {};
  const runCond = async (name, cacheDisabled, throttle) => {
    await send("Network.setCacheDisabled", { cacheDisabled });
    if (throttle) {
      await send("Network.emulateNetworkConditions", FAST3G);
      await send("Emulation.setCPUThrottlingRate", { rate: 4 });
    } else {
      await send("Network.emulateNetworkConditions", NO_NETWORK);
      await send("Emulation.setCPUThrottlingRate", { rate: 1 });
    }
    const runsArr = [];
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      await send("Page.navigate", { url });
      let chartMs = null;
      for (let i = 0; i < 200; i++) {
        await sleep(100);
        const has = await send("Runtime.evaluate", { expression: CHART_EXPR, returnByValue: true });
        if (has.result?.result?.value) { chartMs = Math.round(performance.now() - t0); break; }
      }
      await sleep(300);
      const m = (await send("Runtime.evaluate", { expression: METRICS_EXPR, returnByValue: true })).result?.result?.value;
      m.chartMs = chartMs;
      runsArr.push(m);
    }
    return aggregate(runsArr);
  };
  conditions["cold-unthrottled"] = await runCond("cold-unthrottled", true, false);
  conditions["cold-throttled"] = await runCond("cold-throttled", true, true);
  return { conditions, waterfall: [] };
}

export async function loadAnalysis(ctx) {
  const { ports, oldRoot, newRoot, refA, newLabel, live, runs } = ctx;
  const servers = [];
  if (oldRoot) servers.push(await serve(oldRoot, ports.old));
  if (newRoot) servers.push(await serve(newRoot, ports.neu));
  const log = (...a) => console.log("[bench]  load:", ...a);
  try {
    return await withChrome(ports.cdp, async (send) => {
      const out = {};
      if (oldRoot) {
        log(`old @ ${refA} (${runs} runs × 4 conditions)…`);
        out.old = { label: `old @ ${refA}`, ...(await measureSide(send, ports.old, runs)) };
      }
      if (newRoot) {
        log(`${newLabel} (${runs} runs × 4 conditions)…`);
        out.new = { label: newLabel, ...(await measureSide(send, ports.neu, runs)) };
      }
      if (live) {
        const reachable = await fetch("https://llm-pareto.kaidev.io/", { method: "HEAD", signal: AbortSignal.timeout(5000) })
          .then((r) => r.ok)
          .catch(() => false);
        if (!reachable) {
          log("--live skipped: prod not reachable from this environment (no egress) — old+new still measured");
        } else {
          log(`--live prod (${runs} runs × 2 conditions)…`);
          out.live = { label: "prod llm-pareto.kaidev.io", ...(await measureLive(send, runs)) };
        }
      }
      return out;
    });
  } finally {
    for (const s of servers) s.close();
  }
}
