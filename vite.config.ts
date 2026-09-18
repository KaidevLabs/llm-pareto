import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// publicDir stays the vite default ("public"): public/data, public/js,
// public/assets, public/fonts flow into dist/ untouched — update.py's
// outputs keep their serving surface through the build (028 A2).
export default defineConfig({ plugins: [svelte()], base: "./" });
