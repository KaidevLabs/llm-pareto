# 040 — Bundle echarts from npm (treeshake + dynamic GL chunk)

Date: 2026-09-20. **Status: EXECUTING (step 3/3) — owner go 2026-09-29
("Execute plans/040-echarts-npm.md"), D1–D5 adopted as recommended.**
Source: `docs/reports/030-port-perf-findings.md` B28 (owner question
2026-09-20: "what if we add echarts via package.json?"). **Absorbs B23's
typing scope** (the plan `037-chart-typing.md` is superseded by this one;
its residual — the two component type holes — is already step 5 of
`plans/039-hygiene-batch.md`).

Measured (probe: `.tmp/echarts-probe/`, echarts 5.6.0 via npm, vite + our
minify, treeshaken to exactly our feature set — custom/line/scatter +
grid/tooltip/inside-zoom + canvas):

| | vendored today | npm + treeshake |
|---|---|---|
| eager echarts | 1,034,102 B / 335 KB gz | 505,771 B / **166 KB gz** (−50%) |
| echarts-gl (lazy) | 639,846 B / 175 KB gz | ~unchanged, as a dynamic-import chunk |
| eager JS total | ~378 KB gz | ~215 KB gz (−43%) |

Secondary wins: the parse-blocking body-end classic script disappears (the
bundle is defer by nature — without any shell this alone moves throttled
FCP ~3.3 s → ~1.5–2 s); real `EChartsOption` types replace the
`declare const echarts: any` seam; the `gl.ts` script-inject becomes
`await import("echarts-gl")` (same #468 invariant: await before init).
Not an FCP fix: B19's static shell (~0.6 s) still wins alone; they compose.
Chart-ready stays dominated by data + badge logos (B20).

## Settled decisions (owner approved as recommended, 2026-09-29)

| # | decision | options & recommendation |
|---|----------|--------------------------|
| D1 | Adopt `echarts@5.6.0` (exact pin) from npm | Treeshaken imports per the probe's set. The 019 **byte-pin audit → lockfile pinning** (package-lock integrity hashes) — same supply-chain guarantee, amended mechanism; 020 untouched (bundled = self-hosted, zero third-party requests). Remove `public/js/echarts-5.6.0.min.js`. **(rec) yes.** |
| D2 | `echarts-gl@2.1.0` from npm too | `await import("echarts-gl")` → automatic lazy chunk; delete `gl.ts`'s script-inject; the #468 invariant (GL registered before instance creation) holds by awaiting before `echarts.init`. Remove `public/js/echarts-gl-2.1.0.min.js`. Alt (keep vendored gl + inject): rejected — two mechanisms for one job. **(rec) yes.** |
| D3 | Version policy | Exact-pinned 5.6.0/2.1.0 to match the vendored behavior byte-for-byte in spirit; any bump is a deliberate re-audit (cookie grep + GL probes + A/B), never a routine dependabot merge. **(rec) yes.** |
| D4 | charts.ts typing (absorbed B23) | `import * as echarts from "echarts/core"` + typed instances + `EChartsOption` on the option builders; **zero behavior change** (suites stay green untouched). **(rec) yes.** |
| D5 | Verification gate | DoD carries the bundle numbers (eager JS ~215 KB gz, from ~378) + suites + `npx svelte-check` 0 errors on the seam + CDP probes for the chart/GL seams + cookie grep on the built bundle + harness load A/B (FCP/chartMs unchanged-or-better; zoom settle unaffected). |

## Steps (commit per step; owner stages each diff)

1. Deps + imports: add echarts/echarts-gl, swap charts.ts + gl.ts to
   module imports, delete both vendored files, dynamic GL chunk.
   Commit: `chart: npm echarts (treeshake + lazy gl chunk)` (85a15d0,
   2026-09-29). ✅ COMPLETE
2. Typing pass (D4) on the same imports. Commit: `chart: type the
   echarts seam` (56c7bc0, 2026-09-29). ✅ COMPLETE
3. Verification (D5) + owner A/B; DoD audit. Commit: foldable.

## Out of scope

- The static shell (034) and badge store (035) — independent, compose.
- echarts version bump / upgrade — pinned (D3), separate decision.
- Any render-behavior change (the A2/A4 imperative seam stays).

## Definition of done

- [ ] Owner approves D1–D5 in a review session.
- [ ] Eager JS measured ≈ 215 KB gz (from ~378); GL chunk lazy and ~unchanged.
- [ ] Zero behavior change: suites green untouched; chart/GL probes pass;
      zoom/pan trailing unchanged (018 A2).
- [ ] `npx svelte-check` 0 errors on the seam; cookie probe clean.
- [ ] 019's audit note amended to the lockfile mechanism; vendored files gone.

## As-built — step 1 (2026-09-29, commit 85a15d0)

What happened, in the step's order: `npm install --save-exact
echarts@5.6.0 echarts-gl@2.1.0` (package.json `dependencies`, lockfile
integrity hashes — D1/D3; single echarts/zrender instance, claygl 1.3.0
alongside). New seam module `src/lib/echarts.ts` imports
`echarts/core` + the probe's exact feature set (custom/line/scatter +
grid/tooltip/inside-zoom + canvas) and `use()`s them; `charts.ts`
swaps `declare const echarts: any` for `import { echarts } from
"./echarts"` (every `echarts.*` call site untouched); `gl.ts`'s
script-inject becomes `import("echarts-gl")` with the same
promise-cached `Promise<boolean>` signature, so `render3DPanel`
(whose `.then` keeps the #468 init order) is untouched. `App.svelte`'s
`window.echarts` boot check + the `echartsFatal` CDN branch went away
with the global (the 030 B23 resolution's consequence — the step text
didn't itemize them); the static-shell comment's "~1 MB echarts
download" wording follows the tag out of `index.html`. Both vendored
files `git rm`'d (public/js/ is gone entirely). One addition the step
text didn't name: `src/echarts-gl.d.ts` — echarts-gl 2.1.0 ships no
usable ESM types and nothing consumes its exports (side-effect import
only), so a bare `declare module "echarts-gl";` keeps tsc strict-clean
without a types-only devDependency.

Measured (vite 8/rolldown build, the repo's minify — not the probe's
plain vite): GL chunk 628.23 kB / **175.46 KB gz, lazy** (vendored:
639,846 B / 175 KB gz — D2's "~unchanged, as a dynamic-import chunk"
now measured for real; the probe never installed echarts-gl, so this
was extrapolated until today). Eager JS 663.33 kB / **222.06 KB gz**
(+ a 0.15 KB runtime chunk) vs the DoD's ≈215 from ~378 — the +7 KB
is echarts-gl's static `echarts/lib/...` imports (DatasetComponent and
friends) becoming shared modules the eager path carries; within "≈",
flagged for the step-3 DoD audit. Verified `echarts/lib/echarts`
re-exports the same core `echarts/core` exposes (GL registration lands
on the shared registry) and that `use()` dedupes by installer
reference, so the GL chunk's default CanvasRenderer/labelLayout
re-registration is a no-op.

Verification: `npm test` 180 passed untouched; `npx tsc --noEmit`
clean; `npm run build` clean; headless-Chromium CDP smoke over a
static serve of `dist/` (scratch probe /tmp/opencode/040-smoke.mjs):
2D renders 153 models, wheel/pan/dblclick dispatch without error,
3D pill loads the lazy chunk (performance entry confirms) and renders
147 models · 22 on the frontier with crowns, zero console errors or
exceptions; screenshot reviewed.

## As-built — step 2 (2026-09-29, commit 56c7bc0)

D4's three surfaces, as landed. (1) **Typed instances:** `const charts:
Record<string, EChartsType>`; the params/returns of captureZoom,
resetZoom, bindZoomChart, bindPan, bindDrawerClose, ensureChart2D,
zrOff went `any` → `EChartsType`. (2) **EChartsOption on the option
builders:** `chartOption(...): EChartsOption` with its series array
annotated `(CustomSeriesOption | LineSeriesOption | ScatterSeriesOption)[]`
— the annotation contextually types the pushed literals, so the
`type: "custom" | "line" | "scatter"` tags stay checked and the custom
`d`/`spd`/`vis` payloads assigned clean, no boundary cast needed;
`build3DScene(...): { option: EChartsOption }` with one cast at the
return (scatter3D/grid3D sit outside the core union and echarts-gl's
module surface is declared any — the GL option stays an untyped build,
checked in at the single seam). (3) **Types ride the seam module:**
`src/lib/echarts.ts` re-exports `EChartsOption` (type-only, from the
root module — erased, no bundle impact) and `EChartsType` (from the
core already imported).

The `getOption()` reads (captureZoom, the zoom windows(), bindPan's
mousedown) type their members `unknown` in echarts 5.6 — three local
`as any` casts with a comment keep those zoom-shape reads as untyped
seams, same as they were pre-040. The remaining `any`s in charts.ts
are the echarts callback params (formatter/renderItem/click/symbolSize)
and bindPan's local `drag` bag — the same seams 030 B23 catalogued,
outside D4's instances-and-builders scope. `import type { ... } from
"echarts"` (series union) added alongside the seam import.

Zero behavior change, proven two ways: suites 180 passed untouched,
and the production build is byte-identical to step 1's (same three
asset hashes, index-D9zQ6c1R.js / echarts-gl-CwVWOCex.js /
rolldown-runtime-DK3Fl9T5.js — every change type-only, erased at
compile). `npx tsc --noEmit` clean.
