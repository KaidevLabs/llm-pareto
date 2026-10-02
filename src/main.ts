import { mount } from "svelte";
import App from "./App.svelte";
import { charts } from "./lib/charts";

const target = document.getElementById("app")!;
// 034 D4: mount() APPENDS to the target — Svelte 5's _mount creates its
// anchor via target.appendChild() and keeps any existing children, so the
// static shell from index.html would double the chrome. Clear it first; the
// shell is a copy of the first render, so the swap is a single silent frame.
target.replaceChildren();
const app = mount(App, { target });

// CDP probe seam (.tmp/): the page has no global echarts since 040 (the
// npm bundle) and the built app exports nothing — the headless probes read
// the live chart instances through this (the 028-era window.stP precedent).
(window as { __charts?: typeof charts }).__charts = charts;

export default app;
