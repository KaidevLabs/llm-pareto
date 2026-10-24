import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Self-hosted, cookieless umami analytics — production only (owner directive
// 2026-10-24): the dev server must never call it, and a failing analytics
// endpoint must never hold the app back, so the tag is injected by the build
// and is `async`. The async half is not cosmetic: a classic `defer` script in
// head sits in the browser's deferred-script queue ahead of the app's module
// script, so an unreachable umami left the page on the static shell with no
// chart at all (measured 2026-10-24 — the tag hung and nothing mounted).
const UMAMI_SRC = "https://umami.kaidev.io/script.js";
const UMAMI_SITE = "a706ae8b-0beb-40d0-bee6-a406c5e91dec";

function umamiProd(): Plugin {
  return {
    name: "umami-prod",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { async: true, src: UMAMI_SRC, "data-website-id": UMAMI_SITE },
          injectTo: "head",
        },
      ];
    },
  };
}

// publicDir stays the vite default ("public"): public/data, public/js,
// public/assets, public/fonts flow into dist/ untouched — update.py's
// outputs keep their serving surface through the build (028 A2).
export default defineConfig({ plugins: [svelte(), umamiProd()], base: "./" });
