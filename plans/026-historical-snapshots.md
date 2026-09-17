# 026 — Historical snapshots & evolution viewer (exploration)

Date: 2026-09-17. **Status: PROPOSED** — parked for owner review. Items
graduate to `plans/027-…` up as their own plan docs; execution is gated on
explicit owner approval (021 process).

Source: owner idea-dump (2026-09-17, preserved verbatim):

> "Lets create a exploration plan on storing or saving historic storypoints
> or something like that, like having the last N updates and a selection of
> some of them like 1,3,6 months...
>
> What would be the timeframes? Oh now that i notices we have all of them on
> the git xD
>
> But also adding them a viewer of some how and a slider like a special
> mode to see how this evolver, maybe wiht a play of a button see them in
> action 2d and 3d versions and see how models and or orgs moves around
> this space...
>
> What else could be interesting?"

Plan numbers 001–025 are taken (021 = active backlog doc, 022–025 graduated
from it); surviving items from this doc graduate from **027** up.

## Process

Same process as 002/003/021:

1. **Explore** — per item, one sub-agent task (research only, no code) maps
   the possibilities: feasibility on the current stack (Workers static
   assets, vendored ECharts 5.6 + echarts-gl, committed JSON, zero-dep
   `update.py`, no backend, `ls` no-op build, cookieless site), evidence
   measured not assumed, design options as a consequences ledger, rough
   effort + dependencies. Output: a findings section appended to this doc
   (uncommitted, for owner review).
2. **Plan** — each surviving item graduates to its own numbered plan doc
   `plans/00N-<slug>.md`, grounded in that item's findings.
3. **Review** — owner reviews each plan by hand; nothing is implemented
   until a plan is agreed in a review session.

## Current state (evidenced, measured 2026-09-17)

- **The full history already lives in git** (owner's observation,
  confirmed): 9 commits touch `public/data/` — init `18c68c5` (2026-09-16
  03:28Z) → latest scheduled refresh `e27e7c0` (2026-09-17 11:17Z).
  013's auto-update (cron `15 */6 * * *` UTC) commits whenever a data file
  changes; so far 3 scheduled refreshes → ~2 days of history. Every data
  commit is a full snapshot: arena.json 224 KB, openrouter.json 72 KB,
  combined.json ~97 KB, meta.json ~4 KB, endpoints.json 2.2 MB.
- **The client only needs part of a snapshot**: app.js eagerly fetches
  `combined.json` + `meta.json` (app.js:1835-1836), lazily fetches
  `endpoints.json` (app.js:191). Chart-ready snapshot = combined + meta ≈
  100 KB raw (≈13 KB gz).
- **Both target chart surfaces exist**:
  - 2D: scatter panels (3 price modes + speed mode), per-view 2-D Pareto
    frontier line, org colors + logo badges (app.js).
  - 3D: standalone showcase on vendored echarts-gl 2.1.0, lazy-loaded (023
    D7–D9): grid3D scene, log₁₀ price/Elo/speed axes, 3-objective frontier
    glow + optional `lines3D` ribbon, viewControl rotate/zoom/pan +
    autoRotate.
  - → Time playback feeds the existing renderers; no new chart library.
- **Precedent for tool-owned derived state**: `logos.json` is rewritten by
  `update.py` every run, only when state changes (zero diff on a normal
  run, #392). A history materializer follows the same shape.
- **013's D3 changed-gate** covers arena/openrouter/combined.json
  (endpoints.json excluded; B15-Q5 pending). A new history artifact needs
  the same gate decision.
- **The site is static + cookieless** (020): no runtime third parties — a
  client-side history fetch must be same-origin, or a deliberate exception.
- **Per-board comparability** (#354): Elo scales differ per arena board;
  history is only comparable within one board (the text board, today).

## Items (unexplored — no findings yet)

### H1 — Snapshot store (the data layer)

Owner's ask: "storing or saving historic storypoints … the last N updates
and a selection of some of them like 1,3,6 months".

Framing: git is the lossless archive (owner: "we have all of them on the
git xD" — confirmed above). The store is a **materialization**: `update.py`
derives a curated snapshot set from the data commits, deterministically.
Nothing hand-curated; regenerable from git at any time (self-heal: a lost
or policy-changed history re-derives from the same source).

**Options.**

1. **Materialize into `public/data/history*` from `update.py`** — a fixed
   keep-policy applied to the data-commit history; rewritten only when
   state changes (the logos.json pattern).
   - *Simplifies:* static/cookieless invariants untouched; same-origin
     fetch (the existing pattern); git keeps the lossless full record; the
     first real history is produced by the backfill run — no hand-made
     data.
   - *Complicates:* repo weight grows with the keep policy (bounded by
     the policy); one more artifact in the data-commit review surface
     (mitigated: zero diff when nothing relevant changed); the D3 gate
     decision (open Q3).
2. **Client queries the GitHub API at runtime** (commit list + blobs).
   - *Simplifies:* zero repo growth; the *entire* history reachable (any
     commit, any date).
   - *Complicates:* a runtime third-party dependency (CORS is fine; 60
     req/h unauthenticated; ETag cache is in-memory only) — a new failure
     mode for a static site (site degrades when GitHub is down or
     rate-limits); the curated-selection logic moves client-side; a new
     class of "is the site self-contained?" review.
3. **CF R2/KV storage.**
   - *Simplifies:* unbounded archive off-repo.
   - *Complicates:* worker code beyond static assets; lifecycle + cost
     surface; breaks the "the only logic lives in update.py" simplicity.
     Premature for v1.

**Recommendation: 1.**

**Snapshot record** (draft): `{ts (the commit's meta.fetched_at), commit
sha, combined rows, meta}` — meta included so per-frame data quality
(match rates, join counts, sources) is free history (feeds H3.8).

**Keep policy — answer to "What would be the timeframes?"** Instead of a
hand-maintained "1/3/6 months" list (which needs re-curation as time
passes), a fixed ladder that self-populates:

- **Origin** — the first data commit (`18c68c5`, 2026-09-16): the baseline
  everything is measured against. Kept forever.
- **Daily** — last 1 per UTC calendar day, last 30 days.
- **Weekly** — last 1 per ISO week, last 12 weeks.
- **Monthly** — last 1 per calendar month, all months. The "1 / 3 / 6
  months" marks are simply the monthly snapshots around those horizons —
  they materialize as time passes (today: month 0 = September 2026).

→ ≈ 30 + 12 + N + 1 ≈ 50–60 snapshots ≈ 5–6 MB raw / ~0.8 MB gz, bounded
forever. Cadence note: 4 commits/day means sub-daily motion lives in git
but outside the materialized set; open Q1 asks whether the last 7 days
should stay at full 6-h resolution (+28 ≈ 3 MB, still bounded).

**Format sub-option** (open Q4): (a) a single `public/data/history.json` —
one fetch, in-memory, matches the one-file-per-dataset pattern; ~5.5 MB
raw parse is trivial, ~100–200 KB gz added to page weight. (b) per-snapshot
files `history/<stamp>.json` + a small `history/index.json` — the page
stays unchanged and snapshots load only when the viewer opens (the
`endpoints.json` lazy pattern). (a) for v1, (b) as a non-breaking
evolution, is the working assumption.

**Backfill**: `python3 update.py --backfill-history` (or a one-shot
script) walks `git log --first-parent -- public/data/combined.json`,
extracts each commit's combined+meta (`git show <sha>:…`), applies the keep
policy, writes the history artifact. The first production history comes
from the tool, not hand-made; re-runnable at any time = the self-heal
property.

**Open questions.**

1. Keep-policy numbers: 30 d / 12 w / all-months as drafted? Full 6-h
   resolution for the last 7 days?
2. Snapshot payload: combined+meta only, or also a trimmed
   `endpoints.json` (the only way to ever have speed history; note B14 —
   stats are a 30-min rolling window, so each snapshot's speed is
   "as-of that run", which is exactly what history should be)?
3. 013 D3 gate: include the history artifact (a history-only diff ≈ a data
   change, since a new snapshot only exists when data changed)?
4. Format: single `history.json` vs `history/` + index (see above).
5. Provenance: is the commit sha + a human-readable source label enough,
   or does a snapshot need the full meta (draft says yes)?

### H2 — Time viewer (slider + play, 2D and 3D, "see how models and orgs
move around this space")

Owner's ask: "a viewer … a slider like a special mode to see how this
evolver, maybe with a play button, see them in action 2d and 3d versions,
and see how models and or orgs moves around this space".

Framing: a time dimension over the **existing** surfaces — the 2-D scatter
panels and the 3-D showcase (both exist, current state above). The viewer
is a new control cluster + per-frame data swap through the same
state/render path (the #364 pattern: client state, re-render, no
data-layer changes).

**Core interaction (v1 draft).**

- **Timeline control**: a slider over the materialized snapshots (date
  ticks from the history artifact) + **play/pause** (fixed step, ~1 frame
  per 0.4–0.8 s; speed toggle). Plain DOM, state in memory, cookieless;
  URL-hash shareability is the B16-Q3 precedent if wanted.
- **Pinned domain while playing**: axis range = the union over the played
  range (or the final frame), so motion reads as motion — auto-fit jitter
  would make points move by rescale artifact. The 2-D pan/zoom layer can
  still escape the pin (owner override).
- **Per-frame render**: the existing render path runs on the frame's rows;
  filters/search apply to the current frame; a model hidden in one frame
  and present in the next is an entry/exit — surfaced, not silently
  dropped.

**Movement-encoding options** (composable):

1. **Ghost playback** — the chart shows only the current frame; motion =
   change between frames. Cheapest; relies on the viewer's memory.
2. **Trails** — per-model path t0→t (2-D line series under the scatter;
   3-D via `lines3D`, already vendored). Persistent trajectories = the
   evolution as geometry. 154 models × ~50 frames is clutter → cap to
   top-N by votes/Elo (20–30), or frontier + selected only.
3. **Ghost/delta markers** — previous-frame position as a faint ghost +
   displacement arrow (or a static two-date A/B diff: arrows + Δlabels for
   rank/Elo/price). Precise reading, less "alive".
4. **Entry/exit highlights** — join membership changes between frames
   (the join is not static: 192 unmatched arena / 198 unmatched OR today):
   brief highlight + a "±N since last frame" readout. Cheap, informative.

**3D**: the showcase + playback is the natural home of the owner's
"evolver" image (autoRotate + moving points); trails via `lines3D`; the
per-frame 3-objective frontier glow updates with the frame.

**"Orgs moving around this space"** (org-level): (a) per-org aggregate
points per frame (the org's top-Elo model or a votes-weighted centroid —
an org "comet"); (b) a separate org-aggregate chart (see H3.5). Open.

**Surface question** (owner's call — the design decision this plan holds
for review):

- (i) **A `.seg` mode "⏱ time"** — fits the mode-tab pattern, but time is
  not an axis, it's a *version of the data*; the mode tabs answer "which
  price", not "when".
- (ii) **Orthogonal controls** — a timeline dock under the chart + a play
  pill in `nav.filters` (next to the 3D pill), active over *any* mode,
  2-D or 3-D.
  - *Simplifies:* any axis choice plays back; no mode combinatorics
    (time × price-mode × 3-D would be 3×3×2 modes).
  - *Complicates:* a second control cluster in the nav; the timeline dock
    is new chrome.

**Rough effort** (to refine at explore/plan time): store (H1) **med**;
viewer core (timeline + per-frame render + pinned domain + play loop)
**med**; trails **med**; A/B diff arrows **low–med**.

### H3 — "What else could be interesting?" (owner's question)

Parked candidate list — unexplored, no rankings yet:

1. **Frontier morph** — the Pareto frontier (the site's identity
   highlight) across time: the frame-t frontier ghosted alongside the
   current one; frontier-membership diffs (who entered/left since t0).
   The core highlight's own history — the most on-brand item here.
2. **Elo race chart** — a different chart family: Elo over time as lines
   (per model, or per org), "who passed whom". Org palette reuse; a plain
   ECharts line chart, time on x. A 4th mode or a separate panel.
3. **Price & value drift** — per-model price history (price drops); the
   trend of the value metric (Elo per $) — the metric the site implicitly
   optimizes. "Which frontier models got 30% cheaper" is the concrete
   killer-feature form.
4. **Model-launch timeline** — when each model first appeared in the data
   (a calendar/Gantt of "new on the frontier"); pairs with H2's
   entry/exit detection.
5. **Org aggregates over time** — per org: frontier share, best-Elo trend,
   models-counted trend ("orgs moving around this space" at org level).
6. **A↔B diff panel** — pick any two dates → a compact table: rank
   deltas, Elo deltas, price deltas, entries/exits. The static cousin of
   playback.
7. **Votes & activity over time** — `arena_votes` history (activity proxy;
   also a signal of join robustness).
8. **Data-quality history** — match rate / join counts / match methods per
   run (meta.json is already in the snapshot record → free; a footer
   sparkline at most).
9. **Speed over time** — only if H1's payload includes the trimmed
   endpoints stats (open Q2); per-frame "as-of" semantics, never averaged
   across frames (B14).
10. **Time as a 3-D axis** — instead of (or besides) animation, time as a
    scene axis in the 3-D showcase (replacing the speed axis): a static
    "evolution space" to rotate around.

Ruled out for now (parked, not out-of-scope): **cross-board history** —
Elo scales are not comparable across boards (#354); a multi-board history
is a board-selection question to revisit with 009. **"Predict the next
Elo"** — fun, speculative, parked.

## Open branches (stateable now, parked on purpose)

- **H2 surface decision** (mode segment vs orthogonal controls): hangs on
  the owner's feel for "special mode" (their word) vs "time is
  orthogonal"; a design decision the owner keeps final say on. Revisit at
  H2's explore step, before any chrome is drawn.
- **D3 gate amendment for the history artifact** (H1 open Q3): hangs on
  the keep-policy + format decisions; settles with H1's plan doc.

## Not yet specified

- 3-D playback camera behavior (autoRotate while playing? camera lock?).
- Play defaults (frame step, speed range, loop or stop at the end).
- What "top-N trails" N is, and by which ranking.

## Out of scope

- Cross-board history (board-selection question — parked, not ruled out
  forever).
- Any backend: the static-assets invariant stands (H1 option 3 / H2
  GitHub-API client are the exceptions that would touch it — options, not
  scope yet).
- Hand-maintained history data: the history must be derived from the data
  commits, always.
- Speed-history UI before H1's payload decision (H1 open Q2).

## Definition of done (for this exploration doc)

- [ ] Owner's items recorded with their questions verbatim + context
      (done — Source above).
- [ ] Current-state claims evidenced (measured 2026-09-17 — done).
- [ ] Each item carries options + consequences ledger + open questions —
      done for H1/H2/H3 as parked candidates; findings append at the
      explore step, uncommitted for owner review.
- [ ] No item labeled explored before its explore run.
- [ ] Owner review: items graduate to `plans/027-…` as own plan docs, or
      are cut; this doc is updated accordingly.
