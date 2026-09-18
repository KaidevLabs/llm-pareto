# 028 — Svelte 5 rewrite of the explorer front end

Date: 2026-09-18. **Status: EXECUTING (step 6/6).**
Source: `plans/021-exploration-backlog.md` B18 (frontend framework?), rounds
1–2, and the owner's go ("Then lets go", 2026-09-18). The round-2 findings
are this plan's evidence base — measured, not re-derived here: line budget
(45% imperative chart seam / 28% string-HTML / 12% pure logic), bundle
numbers, maintenance status, live component-test runs, sketch token
measurements, deploy-story costing. Framework question settled: **adopt
Svelte 5**; Solid re-enters only if evaluated after 2.0 settles; Qwik closed.

## Goal

`public/app.js` (2,093-line vanilla) becomes a Svelte 5 + TypeScript
component app built by vite — same features, same look, same data. The front
gains a real test suite (vitest component tests + unit-tested pure-logic
modules, replacing the parked 017 A2 node:test seam). Deploy becomes
build-based (`npm ci && npm run build && npx wrangler deploy`). 027 step 1
(state deep-links) lands inside the rewrite. Parity is proven (CDP 46
assertions + cookie probe + owner A/B) **before** the deploy cutover; the
live site never serves a broken state during the window.

## Settled decisions (owner go 2026-09-18 — do not revisit)

| A# | decision | rationale | date |
|----|----------|-----------|------|
| A1 | Adopt Svelte 5 now. | Only defensible candidate on this stack (stable 5.57, monthly cadence; runes map 1:1 to the current plain-object state model; component tests verified 3/3; 17.3 KB gz runtime = noise vs 357 KB gz echarts+app). Solid = 2.0-rc package re-scope → guaranteed second migration; Qwik = no resumability target + governance + weakest testing. | 2026-09-18 |
| A2 | The build-based deploy surface is accepted as the price: CF dashboard build command becomes `npm ci && npm run build && npx wrangler deploy`; `wrangler.jsonc` `assets.directory` → `./dist` **at cutover only**; lockfile committed; `node_modules/` + `dist/` gitignored. | The owner's "one decision everything hangs on" — answered yes with the go. | 2026-09-18 |
| A3 | TypeScript components. | First-class in Svelte 5; types are machine-checkable intent — strengthens the AI-maintenance case that motivated adoption. | 2026-09-18 |
| A4 | echarts 5.6.0 + echarts-gl 2.1.0 stay vendored global scripts in `public/js/` (019 byte-pin audit intact), loaded as classic `<script>` before the module bundle; the echarts-gl lazy-inject stays script-tag injection, not `import()`. | #468 load-order invariant; npm-echarts measured pure downside (unpins the audit, churns 9 call sites, build coupling for no gain). | 2026-09-18 |
| A5 | Parity is the bar: no redesign, no behavior change. Owner A/B + CDP 46 assertions + cookie probe gate the cutover. | The swap is infrastructure, not a redesign. | 2026-09-18 |
| A6 | Reuse the `.tmp/b18r2` seed (owner question "can this work be reused?"): `sveltedemo/` configs (vite/vitest incl. the browser-condition fix, package.json version pins), `sketch/Details.svelte` + `endpoints.svelte.js` + its 3 passing tests — copied into the tree in step 1, then reconciled against the live drawer code. `soliddemo/` and the tarballs/extracted dists are discarded. | The sketch was written from the current drawer (app.js:1418-1691) at fidelity; the configs carry two solved footguns. Only the drawer+table was ever sketched — everything else is new work regardless. | 2026-09-18 |
| A7 | 027 step 1 is absorbed into this rewrite (URL state in-framework, per 027 A4/A5 as written); 027 steps 2–3 (tour, capture) execute after this plan, in-framework; 017 A2 (ESM split) is superseded — vite+vitest is the JS test seam. | Round-2 sequencing recommendation, accepted in the go: write 027's serializer once, as framework code. | 2026-09-18 |

## Current state (evidence)

- Repo is zero-dep: no `package.json`, no `node_modules/`; `.gitignore`
  lacks `node_modules/`/`dist/`. `wrangler.jsonc` serves `./public`.
  Live serving surface: `public/index.html` + `public/app.js` + data/js/
  assets/fonts — this must stay deployable **unchanged until step 6** (the
  CF git-deploy runs on every push, including the 6-hourly data-refresh bot
  commits, and serves the configured assets dir as-is; #349's "Hello world"
  fallback is what a broken cutover looks like).
- CF git-integration is build-based: the dashboard build command is what
  deploys (#436). Today it is effectively the wrangler deploy of `public/`.
  After A2's flip it becomes `npm ci && npm run build && npx wrangler
  deploy` — flipping it is safe **any time after step 1** (public/ still
  deploys the old app; npm ci/build just add overhead), so the cutover
  itself becomes a pure repo commit.
- vite `publicDir: 'public'` (default) copies `public/` (data, js, assets,
  fonts) into `dist/` at build — `update.py`'s outputs flow through
  untouched; the data-refresh workflow is unaffected (its commits simply
  trigger the full build once the command flips; accepted in A2).
- The CDP harness (`.tmp/cdp_verify.mjs`, zero-dep, 46 assertions under
  `--headless=new --disable-gpu` SwiftShader, 023) is the structural
  verification; it re-asserts against the built `dist/` in step 6.
- Seed artifacts (A6): `.tmp/b18r2/sveltedemo/` — vite 8.3 + vitest 5 +
  @testing-library/svelte 5.4.2, the `resolve.conditions: ["browser"]`
  footgun solved; `sketch/Details.svelte` + `endpoints.svelte.js` + 3
  passing component tests (one real bug already caught by them). Known
  porting notes from round 2: module-level fetch at import time must be a
  gated resource; the drawer's four bespoke conventions (PROV_SORT module
  state, delegated-on-static-shell sort headers, ENDPOINTS quadruple,
  `.then(renderDetails)` settle guard) all dissolve into component state
  and framework resource patterns.
- `.tmp/` is gitignored scratch — step 1's first action copies the seed
  into the tree so the project is self-contained from then on.

## Steps

1. **Scaffold + seed** — `package.json` (svelte 5, @sveltejs/vite-plugin-
   svelte, vite, typescript, vitest, @testing-library/svelte, jsdom),
   `vite.config.ts` (publicDir default), `vitest.config.ts` (browser
   condition), `tsconfig` + `svelte.config`, `.gitignore` +`node_modules/`
   +`dist/`; root `index.html` (new entry: vendored `/js/*.js` classic
   scripts first, then `src/main.ts`); `src/` tree: the state store module
   (port of the plain-object `state`), pure-logic modules extracted
   framework-free (filters/search/pareto/speed aggregation/formatting) with
   unit tests, the seed Details component + tests copied and reconciled
   against the live drawer. `npm run build` → `dist/` (gitignored, never
   deployed in this step). `public/` untouched — live site unchanged.
   Verify: vitest green, build clean, python suite green, storage-API grep
   clean. Commit: `chart: svelte scaffold + drawer seed`.
   ✅ COMPLETE (committed f9736f1, 2026-09-18).
   **As-built:** done as specified, plus these port decisions: the state
   store binding is exported as `ui` — a component cannot import a binding
   named `state` while also using local `$state` runes (compiler-enforced
   store_rune_conflict; every future consumer has local runes). Seed
   reconciled with 4 fixes: `esc()` dropped from all interpolations
   (svelte escapes on its own; the sketch would double-escape), the
   sketch's undefined `endpointsError` reference → `store.error`, the
   per-provider table's missing `ctx` header restored (7 cells under 6
   headers), TS types for Row/Endpoint/Meta. tsconfig strict on;
   svelte-check left out (the step's dep list settles it — vitest is the
   gate). typescript pinned ^5.9.0 (npm latest 7.0.2 is the Go-native
   rewrite major; the vite/svelte toolchain is validated on 5.x). Root
   index.html carries only global CSS (Inter @font-face, :root vars,
   body/#app flex); the drawer's styles moved scoped into Details.svelte;
   remaining shell CSS migrates with its components in steps 2–4.
   App.svelte is a throwaway host (renders data.rows[0]'s drawer),
   replaced in step 2. Verify results: vitest 40/40 (unit values pinned by
   running the real app.js functions through a scratch harness — which
   caught blendedPrice/searchHit being module-state readers, not
   arg-takers), build clean + 6/6 HTTP smoke from dist/, headless render
   of dist/ paints the drawer with zero console errors, python suite 157
   OK, storage-API grep clean. vitest excludes `.tmp/` (was collecting
   the seed demos).
2. **2D panels + controls** — mode seg (general/in/out/speed), pills,
   search, org-families of-panel, spread/frontier toggles as components;
   chart init/update lifecycle wrappers over the imperative seam (not-Merge
   `setOption`, captureZoom/restoreZoom port, logo badges). 2D parity.
   Verify: vitest + CDP probes on the dev build + owner A/B. Commit:
   `chart: 2D panels + controls in svelte`.
   ✅ COMPLETE (committed 74116aa, 2026-09-18).
   **As-built:** done as specified, with these port decisions: shared
   `Seg`/`Pill` controls (options-data driven, aria via rest spread);
   ModeSeg/VisionSeg are Seg instances in App's nav; OfPanel's DOM-builder
   (buildOfPanel/toggleOf*/applyOfSearch/updateOfPanel) became derived
   data + class bindings with identical semantics (SvelteSet expansion,
   escape-clears-then-closes, union org toggles); provSort moved to a
   module store so provider sort survives drawer open/close (live D3);
   the drawer overlay is wired here (click→drawer must work for the A/B),
   shrinking step 4's drawer scope to footer/meta; the tgl-3d pill + 3D
   scene and footer content stay in steps 3/4 (owner confirmed both in
   the step-2 review); boot gates only the charts (data + badges), the
   static shell renders immediately like live. Verify results: vitest
   52/52 (OfPanel/SearchBox/RatioCtl component tests), tsc clean, CDP
   probe on the dev build 29/29 (modes, per-panel scatter, speed
   settle 144, ratio→axis label, spread series, frontier toggle,
   click→drawer, wheel/dblclick/pan-guard, search 15/154, vision 93,
   of-panel tree), python 157 OK, storage grep clean, zero console
   errors. CDP note: Input.dispatchMouseEvent(mouseWheel) never reaches
   the DOM in this headless build (document capture listener sees
   nothing) — wheel validated via a synthetic WheelEvent on the chart
   div; real-gesture parity stays the owner's A/B. Also: tsc joined the
   verify loop this step (it caught a missing type import step 1's
   vite-only pipeline missed).
3. **3D scene** — the 3D panel component; gl lazy-inject preserved
   (script-tag, before first GL render — #468); stale-state guards;
   `#badge-3d`/`#reset-3d`/`#count-3d` chrome. Verify: CDP (SwiftShader
   renders the GL scene) + owner A/B. Commit: `chart: 3D scene in svelte`.
   ✅ COMPLETE (committed, 2026-09-18).
   **As-built:** `src/lib/gl.ts` (promise-cached script-tag inject,
   chart-instance-after-registration per #468) + render3DPanel/build3DScene
   verbatim in charts.ts; PanelKey gained "3d"; Panel handles the 3D reset
   (camera re-render); App has the 3D pill. **Bug the probe caught:** the
   scene built inside the loadEchartsGL().then() boundary — its reactive
   reads were untracked, so frontier/ratio/search changes never
   re-rendered 3D; fixed by splitting sync prep (tracked) from the
   GL-await (init+setOption only). Recorded as constraint #468 (6).
   Verify: vitest 52/52, tsc clean, build clean, python 157 OK, storage
   grep clean, CDP 19/19 on the dev build (pill toggles panels+axis-note,
   one canvas + live SwiftShader WebGL, 144 points, halo, axes, count
   "144 models · 25 on the frontier", frontier off/on round-trip, ratio
   re-render, search, mode-leave, zero console errors). Note: the GL
   canvas id is "" here (023's vanilla repro had "gl--10") — one-canvas +
   webgl context is the invariant, not the id. Owner A/B: "working
   flawlessly" (2026-09-18).
4. **Drawer + provider table + of-panel + footer** — seed sketch
   reconciliation; PROV_SORT → component state; endpoints fetch → resource
   lifecycle (loading/empty/error as framework state); footer/meta. Verify:
   seed tests extended + owner A/B. Commit:
   `chart: drawer + provider table in svelte`.
   ✅ COMPLETE (committed, 2026-09-18).
   **As-built:** drawer + provider table + of-panel already landed in
   steps 1–2 (announced at step 2); this step's remaining scope was the
   footer: `Footer.svelte` (live renderFooter verbatim — spread explainer,
   source links, timestamp, join count + by-method, ⚑ override disclaimer
   gated on meta.join.overrides_applied, cookieless note), replacing App's
   empty footer shell with scoped styles. Verify: vitest 52/52, tsc clean,
   build clean, python 157 OK, storage grep clean, CDP 12/12 on the dev
   build (footer content incl. override line matching meta's 1 override,
   stamp, drawer's 2 provider tables + headers after the footer landed,
   zero console errors). Probe nuance: the drawer check needed a real CDP
   mouse click — a synthetic canvas MouseEvent bypasses zrender's hit
   layer.
5. **URL state (027 step 1, in-framework)** — the serializer as a pure TS
   module (round-trip unit-tested): `view`/`q`/`vis`/`fam`/`ratio`/
   `spread`/`frontier`, defaults omitted; read-once seed before first
   render; replace-on-every-change + push-on-settled + `popstate` per 027
   A5. 027 doc gains its sequencing note (step 1 executed here, steps 2–3
   follow in-framework). Verify: serializer unit tests + owner A/B links.
   Commit: `chart: state deep-links (027 step 1)`.
   ✅ COMPLETE (committed e964d48, 2026-09-18 — plan record rode along in
   the step commit).
   ✅ COMPLETE (committed, 2026-09-18).
   **As-built:** `src/lib/urlstate.ts` — pure serializer, `read(search)` →
   partial patch / `write(ui)` → query, defaults omitted (bare URL
   canonical), unknown values dropped, fam keeps only "org|family" leaves,
   ratio rounded to 1dp — round-trip unit-tested (13 tests). Wired via
   `src/lib/history.svelte.ts`: seedFromURL before first render;
   replaceState on every change; pushState one-entry-per-settled-change
   (discrete toggles push immediately; continuous inputs push at burst
   open and replace within the burst, trailing debounce 600ms); popstate
   applies symmetrically with the apply-guard + pending-burst discard.
   **Bug the probe caught:** the first cut did replace+push on EVERY
   change — each toggle created a duplicate pair and the replace mangled
   the previous settled entry, so back() landed on a duplicate (diag:
   popstate fired, URL unchanged). Restructured to push-at-burst-open /
   replace-mid-burst. 027 doc gained its sequencing note (A7).
   Verify: vitest 65/65, tsc clean, build clean, python 157 OK, storage
   grep clean, CDP 23/23 on the dev build (deep-link restores full screen
   incl. 3D + chart + counts + badge; address bar tracks a mode click;
   3-keystroke burst = one entry `q=gpt+5`; popstate walks
   frontier-restore and back-to-bare; zero console errors). Probe notes:
   the search count is matches over the VISIBLE set (fam+q intersecting to
   0 shows 0/0 — correct), and module state reads in CDP go through a
   dynamic import promise (bindings aren't window globals).
6. **Cutover + close** — (a) verification first: CDP 46 assertions against
   a static serve of `dist/`; cookie probe per the 020 recipe (cookie-jar
   curl over `/` + every asset the HTML references, desktop + curl + mobile
   UAs); full python suite + a `python3 update.py` sanity run (data files
   unchanged modulo natural churn); an old-vs-new comparison for curiosity
   (owner request, 2026-09-18 step-2 review): page weight (network
   transfer) and load timing of the vanilla `public/` app vs the built
   `dist/` app, reported at close; (b) the owner flips the CF dashboard
   build command to `npm ci && npm run build && npx wrangler deploy` (safe
   since step 1: it still deploys `public/`); (c) the cutover commit:
   delete `public/index.html` + `public/app.js` (no dead shims),
   `wrangler.jsonc` → `./dist`, AGENTS.md commands + verification hierarchy
   updated (dev/build/test/deploy); (d) push and verify live == main
   (deployments API + live meta.json + content hash, #436 recipe). DoD
   audit. Commit: `deploy: cutover to the svelte build`.

## Open branches

None — A1–A7 settle the forks; the round-2 findings retire the rest.

## Not yet specified

- ~~TS strictness + whether `svelte-check` joins the verify loop~~ —
  settled in step 1: strict on; svelte-check out (vitest is the gate).
- Port-order micro-details inside steps 2–4 (which panel first) — executor's
  choice; parity bar governs.

## Out of scope

- 005/008/009 pipeline features — land after this plan, as components;
  their plan docs re-anchor to component files in their own review.
- 027 steps 2–3 (guided tour, capture) — execute after this plan.
- Any redesign or interaction change; Playwright E2E (framework-independent,
  a later item if wanted); echarts npm migration; `update.py` or data-layer
  changes; B17 `fetch()` hardening (independent, separate plan when taken).

## Definition of done

- [ ] Feature parity A/B'd by the owner: all 2D panels + speed mode, 3D
      scene, drawer + provider table, of-panel, search, filters,
      spread/frontier, URL deep-links restoring full state (027 A4/A5
      behaviors).
- [ ] vitest suite green (pure-logic units + component tests); CDP 46
      assertions pass against the built `dist/`.
- [ ] Cookie probe clean (020 recipe) over `/` + every referenced asset;
      storage-API grep clean; no runtime third parties (everything still
      vendored/same-origin).
- [ ] Python suite green; `update.py` unaffected (public/data flow
      unchanged through vite publicDir).
- [ ] Live == main after the cutover push: CF deployment entry + live
      meta.json + content hash verified (#436).
- [ ] Docs updated: AGENTS.md (commands + verification hierarchy), 027
      sequencing note, 021 B18 resolution pointer.
- [ ] Old vanilla app removed (public/index.html, public/app.js) — no
      dead compatibility shims.
