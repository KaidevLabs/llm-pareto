import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: "jsdom",
    // .tmp/ is gitignored scratch (seed demos etc) — not part of the suite.
    exclude: ["**/node_modules/**", ".tmp/**"],
  },
  // The browser condition is required for svelte internals under vitest's
  // node resolution — without it the runes runtime fails to load (footgun
  // solved in the 021 B18 round-2 sketch runs).
  resolve: { conditions: ["browser"] },
});
