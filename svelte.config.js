import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  // 034: component CSS compiles into the JS bundle and injects at mount —
  // dev (the plugin's default) and build now agree, and the built index.html
  // carries no render-blocking CSS <link>: the static shell's first paint is
  // one HTML document, the pre-port architecture (the shell look itself is
  // carried by the global style block in index.html).
  compilerOptions: { css: "injected" },
};
