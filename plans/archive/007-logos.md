# 007 — Org logos on the frontier points

Date: 2026-09-16. **Status: ARCHIVED (2026-09-17).** Owner-approved
2026-09-16 (revised D1–D7 + D8); steps 1–3 executed + deployed 2026-09-16
(commits aa02e7e, adc1210, 92a411b, b4a7eb4, 6928a51); DoD closed 74a33a2;
owner-accepted.
Source: `plans/archive/002-exploration-backlog.md` item B4 + its exploration findings.
Amended 2026-09-16 (owner directives, replacing old D1/D4): all non-frontier
bubbles keep a fixed size and the current per-org color; the org logo appears
only on the frontier points, each carrying a small permanent name label; the
frontier line stays a pure line.

Owner approved the revised plan 2026-09-16 (DoD item 1; org color + two-tier
sizing settled in review; execution in a separate session).

Amended 2026-09-16 (owner decision, during step-1 execution): logo
maintenance is owned by the framework (option B, over D6-only manual
curation and a helper subcommand), and the registry is owned by
`update.py`, not hand-maintained. `logos.json` at repo root is a
per-org registry (file, url, license, fetched) that `update.py` creates
and maintains: an entry is auto-created when a new org appears in the
data; any entry whose file is missing but has a url gets fetched +
square-verified and written atomically; entries without a url get a
candidate-source report; the file is rewritten canonically only when the
state changes (no spurious diffs in a data commit). The step-2 bring-in
run generates the registry against the real data — the dogfood test of
the machinery; the only hand-added fields are url, license, transform
(curation decisions). Soft-fail: logo
trouble never blocks a data run (fallback glyph holds, per D6). The site
map is the `logos` key of `meta.json` (org → filename), written by
`update.py` from the registry on every run — app.js derives
`assets/logos/<file>` mechanically, so a new org's logo needs no JS
change (owner directive 2026-09-16, step-3 review: the hardcoded
`ORG_LOGOS` const is retired). See D8.

Every non-frontier bubble is a fixed-size org-colored circle (identity exactly
as today). Every frontier point is an org logo (ECharts
`symbol: 'image://…'`, committed asset) with a small permanent label showing
just the model name. The gold override ring and top-10 glow survive via
`itemStyle`; the frontier line is untouched (same path / width / glow). No
runtime hotlinking.

## Proposed decisions (settled at owner review)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Non-frontier bubbles: fixed size (~10px), org color exactly as today (`ORG_COLOR`). Frontier points: org logo symbol (~18px) + small name label. Frontier line: `symbol: 'none'` — a pure line; logos and labels live as per-data items on the scatter series | Owner directive 2026-09-16. Measured: frontier = 10 of 154 points at the default 3:1 blend; at 10px a logo is a smudge (old D3), hence two size tiers |
| D2 | Identity: per-org, keyed by `orgOf` (~23 orgs); fallback glyph = initial-in-circle on the existing fallback gray — now only ever visible on frontier points | Per-model identity is v2; the fallback keeps the chart unbreakable |
| D3 | Assets: brand-color logos normalized to a square canvas at import (SVG where available, PNG otherwise), committed under `public/assets/logos/<org>.{svg,png}`; org→file map in `meta.json`'s `logos` key (tool-generated, D8 — no map in app.js); provenance (source URL + license per org) recorded alongside | Measured sourcing (002 findings): OpenRouter API has no logo field; OR page icons are per-author-slug with provider fallbacks and mixed formats (Minimax→Modular, Z.ai→SiliconFlow); simple-icons/worldvectorlogo/official og:images cover all top-11 orgs. Pre-squaring means `symbolSize` needs no per-item `[w,h]` (Mistral is 191×135, Gemini 16×16) |
| D4 | Two fixed sizes: 10px regular / 18px frontier logo (final values = step-3 A/B). `bubbleSize()`, the lo/hi votes computation in `chartOption()`, and the axis-note "bubble: arena votes" clause are deleted; votes survive only in the tooltip | Old D4 (10px floor) retires; the votes size-encoding is dropped by directive, so none of it becomes a dead-compat shim |
| D5 | Label: frontier points only. Text = cleaned `or_name` (parentheticals + "Org: " prefix stripped), ~10px font, position `top`, `labelLayout: { moveOverlap: 'shiftY' }` — shift, never hide. The extraction is shared with `familyOf` via a small `displayName(d)` helper | The frontier is recomputed per filter, so label overlap must be handled natively (ECharts 5.6 `labelLayout`), not manually; longest measured frontier name is 27 chars ("Qwen3 30B A3B Instruct 2507"); the helper has two real consumers (`familyOf` body, frontier label) |
| D6 | `update.py` validates the org→file map against the data on each run: a new org in `combined.json` without a logo → match-report warning + fallback glyph, not a hard fail | Graceful degradation; the chart never breaks on a new org (old D5, unchanged) |
| D7 | Tooltip: the "frontier" tag moves from the line series into the scatter formatter via a per-panel frontier set; the marker-less line keeps no tooltip. Legend rows keep the old plan's logo + org name row | A marker-less line tooltip only fires on the 2px path — unusable; 006's frontier-click then binds to a single series |
| D8 | Logo registry: `logos.json` at repo root (org → {file, url, license, fetched}) is owned and maintained by `update.py` — entries auto-created for new orgs, fetch + square-verify + atomic write for entries whose file is missing but have a url, candidate-source report for entries without a url, canonical rewrite only on state change; the step-2 bring-in run generates the registry (dogfood) — human fields = url/license/transform only. `meta.json` gains a `logos` key (org → filename, only files on disk) written from the registry each run — app.js derives `assets/logos/<file>` mechanically, so new logos need no JS change and the match report no longer prints an app.js line | Owner decision 2026-09-16 (B over A = manual curation, C = helper subcommand): the URL choice is the only per-org human decision; the framework owns entry/verify/place, so the registry self-heals per org on the next data refresh; the registry is a tool-maintained state file (like the public/data outputs), never hand-edited beyond url/license/transform; logos stay committed-local (no runtime hotlinking, D3); the site map lives in the data, not in app code (owner directive 2026-09-16, step-3 review) |
| D9 | Chart gestures (owner A/B, step-3 review): wheel = 2D zoom of BOTH axes anchored at the cursor; drag = 2D pan of BOTH axes; double-click or ⤢ fit = reset. Native inside-dataZoom gestures are disabled (`zoomOnMouseWheel: false`, `moveOnMouseMove: false` on both) and the dataZoom windows are driven by manual `dispatchAction` (startValue/endValue round-trip exactly; percents map linearly across [min, max] even on the log axis — verified against 5.6.0). Wheel/drag listeners bind in the CAPTURE phase on the chart div — zrender's canvas listeners stopPropagation on wheel and on mousemove while a button is down (verified on 5.6.0), so bubble/window listeners never see the events | The ECharts inside-dataZoom interaction mutex makes a native drag pan only the x-axis (the two inside dataZooms fight for the gesture); a native wheel zooms one axis only. The owner settled the model after A/B: per-axis wheel → final "wheel zooms both, click pans both". Zoom-out clamps at the fit bounds (the fit view is the widest window, 018 A4) |
| D10 | Frontier logo badge (owner A/B, step-3 review): the logo sits on a solid dark disc (`#0a0e16`, no transparency, no glow at rest — owner iteration: the translucent 0.92 disc + top-10 rest glow read soft) with an org-color ring — composited once per org at load on a canvas (256², disc r≈112, ring 16, logo fitted ≤150), used as the `image://` symbol at 24px (hover scale 32, hover glow 18 follows the disc's alpha — the glow halos the bubble, not the logo). The scatter series z is above the frontier line's (7 > 6) so the badge sits in front of the line. Frontier label = `<model name> (<elo>)` via per-data `label.formatter` in a hard chip (solid bg `#0a0e16` = the badge disc's surface, org-tinted border at 0.18 alpha, 1px, radius 2, padding [3,8] with lineHeight 10 — owner-iterated to the slim strip, 9px Inter 600 `#e2e8f0` single tone, 4px above the badge) — 5.6.0 silently ignores per-data `label.text` (it rendered the default value formatter: the owner saw numbers, not names). ECharts image-symbol prefix is `image://` (two slashes) — a single `image:` prefix falls through to a rect symbol and renders nothing (both verified against the live 5.6.0, pixel census + scene graph). A richer two-tone caption (dimmed elo span) is BLOCKED on 5.6.0: rich-formatted inner-text labels build their chip + tspans but paint no text (repro'd minimal; echarts 6.1.0 paints the same repro — revisit only on an echarts upgrade, which would re-open the gesture/emphasis surface) | Owner directives 2026-09-16 ("a little cozy thing to wrap around the logo… the glow on the bubble not on the logo"; then "hard background, no transparency… in front of the line… add a label box"); single-series design keeps the existing emphasis machinery with no cross-series plumbing; the ring bakes into the image so no square itemStyle border strokes the badge's bounding box |

## Steps (commit per step; owner stages each diff)

1. `update.py`: the D8 logo registry — auto-create entries for orgs in
   `combined.json`; candidate-source report for entries without a url;
   fetch + verify + write for entries with a url and a missing file
   (magic-byte sniff, size cap; SVG square-normalized on write, PNG/ICO
   checked for squareness, other rasters flagged for a manual pass — the
   file lands safe because the app.js map is the gate); canonical rewrite
   only on state change; soft-fail. Human-owned fields: url, license,
   transform. `tests/test_logos.py` seam, red-green (tdd discipline).
   Commit: `chart: logo registry in update.py`
2. Bring-in (dogfood): run the registry → fill the ~23 urls (curated
   sourcing) → run → the machinery fetches + normalizes + writes the
   files and fills `file`/`fetched` → one-shot transforms on the flagged
   rasters (downscale, recolor, background knockout, ico frame, avif→png),
   recorded in `transform` → idempotent re-run (zero diff) + contact
   sheet. The `logos.json` in this commit is generated, not hand-written.
   Commit: `chart: org logo assets`
3. app.js + index.html: logo + legend from `meta.json`'s `logos` key
    (D3/D8 — no map in app.js, `logoFor(org)` derives the path);
    `displayName()` helper (D5); two-tier fixed sizes (D4, delete
    `bubbleSize()`); per-data frontier logo + label + `labelLayout`
    (D1/D5); frontier line `symbol: 'none'` + tooltip move (D7);
    fallback glyph (D2); axis-note clause out (D4); org-legend row gains
    logo + org name (D7).
    Commit: `chart: frontier logos + name labels`
4. Review pass: first-paint flash (zrender loads images async — documented
   behavior), dim states, ring/glow on image symbols, label
   legibility/overlap A/B, size A/B (10/18). 006's drawer header reuses the
   org logo when 006 lands.
   Commit only if something changes.

## Execution log

### Step 1 — D8 logo registry in update.py (executed 2026-09-16)

Built test-first at the `tests/test_logos.py` seam (47 tests, red-green per
slice: `logo_slug`, `sniff_image`, `png_size`, `svg_viewbox`,
`normalize_svg`, `ico_best_png_frame`, `load_logos`, `logos_sync`, parallel
fetch phase). `logos_sync` = per-org classification phase → parallel soft
fetch (`ThreadPoolExecutor`, 8 workers, per-url exception containment,
url dedupe) → deterministic verify/write/report. SVGs square-normalized on
write (viewBox centered + width/height, surrounding attributes preserved,
no doubled spaces); PNG/ICO squareness checked (ICO = largest PNG frame);
JPG/AVIF written + flagged manual; 512KB cap; discovered-asset path
(slug file on disk, no registry entry); stale entries kept + info line;
registry rewritten canonically only on state change.

Dogfood findings fixed before commit: sequential fetch too slow for bulk
onboarding (23 orgs, slow CDN hosts → run killed at 4 min) → parallel phase
(~62s real run); a slug variable leak after the phase restructure (every
write named `rekaai.svg`) → per-org slug in phase 2 + regression test.

Verified: 102-test suite green; real `python3 update.py`:
`23 orgs — 23 ok, 0 manual, 0 new`; idempotent (md5-identical `logos.json`
+ assets across back-to-back runs).
Commit: `chart: logo registry in update.py`

### Step 2 — bring-in of the 23 org logos (executed 2026-09-16)

Seed = 23 entries with `url` + `license` only (human curation); files
deleted; the real run fetched/normalized/wrote 17 orgs and flagged the 5
manual (thirty seconds of parallel fetch), as the dogfood was meant to.
One-shot transforms on the flagged set, recorded in `transform`: Moonshot
1024²→256², StepFun 264×60 → recolor #e2e8f0 + square pad, Thinky jpg
knockout (fuzz 8%) fitted to 512², Upstage avif→png 326², SpaceXAI ico →
48px frame (the container holds BMP frames, no PNG), Inception mark-only
extraction, arcee-ai `url: null` + committed file (inline SVG in the
homepage, no fetchable asset URL — the discovered-asset path is its
permanent one-line report). 7 simple-icons SVGs: brand-hex fill inserted
(the current simple-icons format omits `fill` → default black).

Self-test (regenerated set vs the hand-curated reference): 3 rasters
pixel-identical (AE 0), stepfun 38 px (0.0005%), thinky 305 px (0.12%);
SVGs semantically identical (attribute order / float formatting only).
Self-diff caught two discrepancies: the OpenAI knot was black in the
reference where the plan rule says white (applied `fill="#ffffff"` —
A/B flag for the owner); the simpleicons CDN (Gcore edge) is
unreachable from the dev machine, so those 7 urls moved to
`raw.githubusercontent.com` (same CC0 assets).

Verified: real run `23 orgs — 23 ok, 0 manual, 0 new`; idempotent
(md5-identical across back-to-back runs); contact sheet
`.tmp/logos/contact-final2.png`.
Commit: `chart: org logo assets`

### Step 3 — frontier logos + name labels in app.js (executed 2026-09-16)

Implementation: `logoFor()` from `meta.json`'s `logos` key (D8 site map —
the hardcoded `ORG_LOGOS` const is retired; `logos_for_site` in update.py
writes the key, tested at the same seam); `displayName()` shared with
`familyOf`; two-tier sizes (10 / 18, votes encoding deleted); frontier
line `symbol: 'none'`; legend chips as house-token buttons, then removed
(owner A/B — logos moved to the tooltip + org/family panel instead);
D9 gestures (capture-phase wheel/drag on the chart div, batched
dataZoom dispatch, fit-button lazy chart-ref fix); lag fixes
(`animationDurationUpdate: 0` — 300ms default trailed the cursor; one
batched dataZoom action per event — 5.6.0 silently no-ops the
array form of `dispatchAction`; tooltip hidden while dragging).

Owner A/B settled at review: the frontier badge (D10) and the
`<name> (<elo>)` label. Two 5.6.0 quirks found while verifying the
label ("the labels were numbers on screen"): per-data `label.text`
silently ignored → the default value formatter rendered; and the
single-slash `image:` prefix (the old fallback glyph's, and the
first badge wiring's) drew an invisible rect. Both pinned to
memory and to code comments.

Verified headless (CDP, trusted input): the full gesture suite
(cursor-anchored 2D wheel zoom, 2D drag pan exact to the expected
windows, fit reset, zoom-out clamp); emphasis scale + glow on the
badge disc (canvas pixel census: +720 px on highlight, clean
downplay); label ink present + formatter text correct; 23/23 badges
composited (disc alpha, org-color ring, transparent corners); the
badge-absent fallback path re-renders the raw logo; tooltip shows
raw logo + `<name> (<elo>)` fields; `node --check` clean; Python
suite 105 green (step-3 seams: the two updated report-line
characterization tests + the `logos_for_site` tests).
Commit: `chart: frontier logos + name labels`

## Out of scope

- Per-model logos, monochrome/recolor mode, hotlinked assets, per-logo
  animation, labels on non-frontier bubbles.

## Definition of done

- [x] Owner approves this plan (incl. the logo set + step-3 A/B picks).
      (2026-09-16 — approved as revised D1–D7; the logo set + A/B picks settle
      at step 3.)
- [x] All non-frontier bubbles render at the fixed size with the current org
      color; votes are no longer encoded in size (tooltip only, axis note
      updated). (2026-09-16 — CDP-verified: 145 circles at 10px, two-tier
      sizes exactly {10, [24,24]}, votes only in the tooltip.)
- [x] Frontier points render the org logo (fallback glyph when missing) plus
      the small name label; nothing else is labeled. (2026-09-16 — badge
      composite on all 9 frontier points; fallback = initial-in-circle
      badge; labels only on frontier.)
- [x] Frontier line, override ring, top-10 glow, spread bars visually
      unchanged. (2026-09-16 — line pure symbol 'none' with its own glow;
      rest glow removed from points per owner A/B, hover glow kept;
      override ring retained for override points.)
- [x] New org: `update.py` auto-creates the `logos.json` entry on the next
      run; with a url it auto-fetches (soft-fail; match-report line);
      without → candidate URLs (D8). No app-side change — the site map
      is `meta.json`'s `logos` key, regenerated every run.
      (2026-09-16 — step 1: covered by tests/test_logos.py, incl. the
      candidate-probe and soft-fail paths; step 2 dogfood: the arcee-ai
      no-url path reports its one line every run; step-3 amendment:
      `logos_for_site` + the meta.json key, tested at the same seam.)
- [x] Deployed per A10. (2026-09-16 — pushed aa02e7e..6928a51; the CF
      git-build stalled at "pending", so deployed manually with
      `npx wrangler deploy` after removing the leaked `public/.wrangler`
      cache dir first; live app.js hash verified == disk, meta logos 23
      orgs, `/.wrangler/` path 404.)
