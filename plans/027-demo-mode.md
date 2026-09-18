# 027 — Demo: view deep-links, guided 3D tour, capture

Date: 2026-09-18. **Status: PROPOSED — eureka complete (A1–A6 settled);
step 1 executed via 028 (A7), steps 2–3 awaiting owner review and 028's
close.** Sequencing resolved per the owner's pick (option 2, 2026-09-18):
the B18 framework exploration ran first — and concluded: **adopt Svelte 5**
(021 B18 SETTLED; plan 028 EXECUTING 6/6, cutover commit made, push/live
check pending owner signal) — with 027 step 1 absorbed into the rewrite
(028 A7) rather than the plan waiting.
Source: owner 2026-09-18 — "how would you recommend to make a demo of this
new 3d feature, i dont want just to put a image, i want something else";
direction settled in the same exchange: three steps — deep-links (3D + the
2D views, "maybe more?"), the guided tour with a tiny hidden button and its
own deep-link, and a Chromium capture of the tour.

## Goal

The 3D showcase becomes its own demo, no static image involved:

1. **Deep-links** — a URL that lands a visitor in an exact screen: view
   (2D modes or 3D) plus the filter state (search, vision, org-families,
   ratio, spread, frontier), so "here, click this" is the demo of the
   product itself.
2. **Guided tour** — a self-running camera flight through the 3D scene
   (wide orbit → the interesting shelves → frontier close-up) with short
   caption chips, triggered from a tiny tucked-away button or its own
   deep-link; works screenshared, in person, or left running on a monitor.
3. **Capture** — a scripted headless-Chromium recording of the tour as a
   small webm, generated from the live thing rather than hand-made,
   committed and embedded in README.md so the repo itself demos the
   feature.

## Settled decisions (owner, 2026-09-18 — do not revisit)

| A# | decision | rationale | date |
|----|----------|-----------|------|
| A1 | Three steps, in order: (1) view deep-links, (2) the guided tour (+ tiny hidden button + tour deep-link), (3) Chromium capture of the tour. | owner's plan shape, verbatim: "3 steps, deep-links to access 3d y 2d (maybe more?) then the tour… also a deepling to it and then the capture this with a chromium" | 2026-09-18 |
| A2 | The tour trigger is a tiny, tucked-away button (placement delegated to the plan; proposal in step 2). | "i would also add a button to it but really little and hide it somewhere" | 2026-09-18 |
| A3 | The tour has its own deep-link (autostarts the tour on load). | "also a deepling to it" | 2026-09-18 |
| A4 | The deep-link carries the **whole filter state**, not just the view: mode/3D, vision, search, org-family selection, spread, frontier toggle, ratio — a link restores the full screen. | owner, escalating from "view only": "we could put all filters onto the url bar so if we selected a input:output, 3D and filtered some orgs it would load that" | 2026-09-18 |
| A5 | **Full history participation**: pushState + popstate — back/forward walks the filter states. Write model: `replaceState` on every change (address bar always live) + `pushState` on a *settled* change — discrete toggles (mode/3D/vision/families/spread/frontier) push immediately; continuous inputs (search typing, ratio slider) push on a trailing debounce so one entry covers a typing burst. `tour=1` is an entry action, not state: stripped from the URL after autostart so history never replays the tour. | owner pick from B1 options ("Full history participation"), 2026-09-18 | 2026-09-18 |
| A6 | The captured tour webm is **committed and embedded in README.md** (GitHub renders it) — the repo's front door demos the feature. Consequences accepted by the owner: a MB-scale binary in git history; the capture script stays in `.tmp/` (scratch), only the output is committed. Size/quality target is a step-3 parameter (short tour, VP9/WebM, kept small). | owner pick from B2 options ("README embed"), 2026-09-18 | 2026-09-18 |

## Current state (evidence, post-028 — Svelte 5 + TS, vite → dist/)

- **Step 1 is landed, in-framework**: `src/lib/urlstate.ts` (pure
  serializer: `view` = general/in/out/speed/3d, `vis`, `q`, `ratio`
  (rounded to 1 dp), `spread`/`frontier` inverted flags, `fam`
  comma-list; defaults omitted both ways; unknown values dropped;
  `selected` deliberately excluded — the 027 out-of-scope rule in code),
  `src/lib/history.svelte.ts` (the A5 model: seed-once, replace
  immediately, push on settled changes; continuous inputs open a burst —
  first change pushes, continuations replace that entry, a 600 ms
  trailing debounce closes it; popstate applies symmetrically behind an
  `applying` guard and drops a pending burst). Wired in
  `src/App.svelte:43-60` (seed → initHistory → the reactive
  notifyChanged effect). Unit-tested: `src/lib/urlstate.test.ts`
  (round-trip included).
- **The 3D scene** (the tour's stage): `src/lib/charts.ts`
  `render3DPanel`/`build3DScene` — one scatter3D "models" series + the
  glow halo series, `grid3D.viewControl` distance 230 / min 60 / max
  500, `autoRotateAfterStill: 4`; the echarts instance is created only
  after the cached `loadEchartsGL()` resolves (`src/lib/gl.ts`, script
  injection per 028 A4 / #468); a stale-state guard covers leaving 3D
  mid-load. `?reset` camera semantics: the panel's "⤢ fit" pill
  re-renders the scene (Panel.svelte:51).
- **The tiny tour button's home**: `src/components/Panel.svelte`
  panel-head (h2 + badge + ⤢ fit pill + count) — the tour pill joins as
  a 3D-only conditional sibling of the fit pill.
- **JS test gate now exists** (017 A2 superseded by 028): vitest + tsc —
  `npm test` (65 tests / 12 files, all pass) + `npx tsc --noEmit` clean
  (2026-09-18). Behavior-changing steps drive the `tdd` skill at
  declared seams.
- **Verification harness**: `.tmp/cdp_verify.mjs` (zero-dep node ≥22 +
  headless Chromium; re-aimed at the vite build in 028; 46 parity
  assertions). Headless WebGL confirmed working on this stack (#468:
  SwiftShader, one-canvas assertion, synthetic WheelEvent).
- **Capture tooling**: `ffmpeg` at /usr/bin/ffmpeg — CDP
  `Page.startScreencast` frames → ffmpeg image2 mux.
- Cookieless (plan 020, settled): no storage APIs anywhere; URL params
  are the only state surface this plan may touch; the vite build serves
  no runtime third parties (echarts + echarts-gl stay vendored globals,
  028 A4).

## Steps

1. **State deep-links** — ✅ executed per 028 A7 (in-framework, Svelte).
   History: vanilla commit `e964d48` (027 step 1 as originally planned,
   `public/app.js`), superseded by the 028 rewrite — final form is
   `src/lib/urlstate.ts` + `src/lib/history.svelte.ts` (same A4 param
   set, same A5 history model, unit-tested; the burst mechanics refined:
   a continuous burst pushes once and absorbs continuations by
   replacing). Parity + deep-links verified by 028's CDP harness.
2. **Guided tour** — `src/lib/tour.ts` (new module: the tour engine —
   waypoints, rAF camera flight, caption chips, cancel-on-interaction,
   return-to-idle) + `src/components/Panel.svelte` (the tiny 3D-only
   tour pill next to the fit pill) + the `tour=1` deep-link autostart
   (read + strip in the boot path before `initHistory` seeds — tour is
   an entry action, not state, so the URL is cleaned before the first
   history entry; A5). 2D modes untouched — the tour exists only inside
   the 3D scene. Commit: `chart: 3D guided tour`.
3. **Capture** — a zero-dep `.tmp` script (CDP screencast + ffmpeg):
   loads `?view=3d&tour=1` clean, records the full tour, muxes to webm,
   reports duration/size. The output is committed and embedded in
   README.md (A6). Commit: `demo: capture the tour`.

## Open branches

None — all branches settled 2026-09-18 (A1–A6).

## Not yet specified

- Tour script content — waypoints + caption copy + pacing (drafted in
  step 2; the owner edits at review — the visual judgment is theirs).
- Capture parameters (viewport, fps, webm vs gif-for-social, size
  target) — settled inside step 3; A6 pins the destination (README).

## Out of scope

- `state.selected` (the open details drawer) in the URL — transient UI,
  not a shareable view.
- Per-axis 3D selectors, the lines3D ribbon (023 parked), latency view
  (023 out-of-scope carryover).
- Any server-side surface, cookies, or storage (cookieless rule #333).

## Definition of done

- [x] A link carrying mode/3D + filters (search, vision, families, ratio,
      spread, frontier) restores that exact screen; defaults stay out of
      the URL so the bare link stays canonical; unknown values degrade to
      defaults; the address bar tracks clicks. — `src/lib/urlstate.ts` +
      `urlstate.test.ts` (round-trip); 028 CDP parity.
- [x] Back/forward walks filter states (discrete toggles one entry each;
      a search typing burst lands as one entry). —
      `src/lib/history.svelte.ts` (burst + popstate guard). The third
      clause (the tour never replays via history) verifies at step 2.
- [ ] `?view=3d&tour=1` autoplays the tour; the tiny button does the
      same; any interaction cancels cleanly back to normal 3D behavior.
- [ ] The capture produces a webm of the full tour from a clean headless
      run (duration/size reported); it is committed and embedded in
      README.md (A6).
- [ ] Cookie probe clean (no new storage or cookies) over `/` + assets.
- [ ] Owner A/B: links + tour feel right; the README capture accepted.
- [ ] Deployed (live == main), if the site surface changed.
