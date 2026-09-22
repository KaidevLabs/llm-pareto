import { mount } from "svelte";
import App from "./App.svelte";

const target = document.getElementById("app")!;
// 034 D4: mount() APPENDS to the target — Svelte 5's _mount creates its
// anchor via target.appendChild() and keeps any existing children, so the
// static shell from index.html would double the chrome. Clear it first; the
// shell is a copy of the first render, so the swap is a single silent frame.
target.replaceChildren();
const app = mount(App, { target });

export default app;
