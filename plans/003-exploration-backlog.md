# 003 — Exploration backlog (API, ops, indexes, branding)

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**

Source: owner's post-002 ideas (2026-09-16). Second exploration backlog; it
**continues 002's ID space** (B1–B7 live in `plans/002-exploration-backlog.md`)
so item references stay unique across the two backlogs.

## Process (how this backlog gets worked)

Same process as 002, with the graduation rule stated explicitly
(owner clarification 2026-09-16):

1. **Explore** — per item, one sub-agent task (research only, no code) maps the
   possibilities:
   - feasibility on the current stack (Workers static assets, ECharts,
     committed JSON, zero-dep `update.py`, no backend, `ls` no-op build)
   - evidence: measured, not assumed — live fetches, data counts, file:line
   - design options as a consequences ledger (what it simplifies / complicates),
     not a pre-baked solution
   - rough effort (low/med/high) and dependencies on other backlog items
     (B1–B13, either backlog)
   - output: a findings section appended to this doc
2. **Plan** — each item that survives exploration graduates to **its own
   numbered plan doc** `plans/00N-<slug>.md` (001/002 style: goal, settled
   decisions table, steps, DoD), grounded in that item's findings. One plan per
   examination — items are not merged into a shared plan; if two items turn out
   to be better built together, that merge is an explicit owner decision at
   review and the merged doc says so.
3. **Review** — owner reviews each plan by hand; nothing is implemented until a
   plan is agreed in a review session. Plans execute in owner-chosen order;
   items may be dropped, merged, or reordered at review.

## Backlog (order below is not priority)

### B8 — API endpoint returning the processed data

Expose the processed data (arena×OR join + meta) as an API endpoint for
programmatic consumers.

**Preliminary evidence (in-session, 2026-09-16):**

- The four committed JSONs (`public/data/{arena,openrouter,combined,meta}.json`)
  are already public, stable URLs — a de-facto same-origin API; the app itself
  fetches `combined.json` + `meta.json` (app.js:428-429).
- Measured live (curl, 2026-09-16): `/data/combined.json` returns
  `content-type: application/json`, an `etag`, `cache-control: public,
  max-age=0, must-revalidate`, but **no `Access-Control-Allow-Origin`** —
  cross-origin consumers (other origins, a JS client on a different host) cannot
  fetch the data today.
- Stack constraints (001 A10): Workers static site, `wrangler.jsonc` assets =
  `public/`, dashboard build command `ls` (no-op). Any change must keep the
  zero-build property.
- The main open mechanical question: whether a plain-JS worker `main` entry
  (`export default { fetch }`, assets via `env.ASSETS.fetch` pass-through)
  coexists with the current assets-only config and the `ls` no-op build —
  verify against the installed wrangler, and verify a handler bug can't 500 the
  whole static site (every path goes through `fetch()` first).
- Endpoint-shape candidates for the exploration: (a) zero code — document the
  committed JSONs as the API; (b) minimal worker `fetch()` handler exposing
  `/api/v1/models`, `/api/v1/meta`, … with `ACAO:*` and real cache headers;
  (c) a single `/api/v1/data` bundle `{meta, combined}`. Plus: ETag/304
  behavior, preflight, and whether the handler should serve anything beyond the
  four committed files.

### B9 — Kaidev footer / brand notice

A footer line or little section at the bottom announcing Kaidev and our
services.

**Preliminary evidence (in-session, 2026-09-16):**

- The footer exists and is JS-populated: `index.html:311` `<footer id="footer">`,
  filled by `renderFooter()` (app.js:347-372) with the spread-bar legend, source
  links (LMArena, OpenRouter), `fetched_at`, join counts/methods, and the
  overrides disclaimer; a separate `#stamp` line carries "N models · updated …".
  Footer CSS at index.html:225-236 (dark theme, gold `.ov` disclaimer).
- Brand surface today: zero — no logo, no `kaidev.io` link anywhere on the site
  (the only `kaidev` mentions in-repo are the README/plan deploy URLs).
- Open for the owner: what "our services" means (KaidevLabs org, `kaidev.io`
  domain — list named services or just link the domain and let it answer);
  placement (footer line vs corner badge vs a small section above the footer);
  size (owner's own word: "little section notice").
- Synergy to check in exploration: 002 B2's Epoch CC-BY attribution (002 B2 open
  question 6) has no home yet — one footer could carry brand + data attribution;
  OG/meta tags for link previews are the adjacent branding surface (see B13).

### B10 — Automated update + deploy (cron)

A cron job that runs `update.py` and then deploys — on GitHub Actions or on a
local Linux server — replacing (or shadowing) the manual-only flow.

**Preliminary evidence (in-session, 2026-09-16):**

- Current flow (settled, 001 A1/A8/A10 + project memory): manual
  `python3 update.py` → review `public/data` diff + `meta.json` → commit → push
  to main → CF git auto-deploy (build command `ls`). A failed run (exit ≠ 0) is
  never committed. This plan **amends the "manual only" convention** — that is
  the decision the owner makes at review, not a silent drift.
- `update.py` is unattended-friendly by construction: zero-dep (stdlib), two
  URL fetches, fail-fast thresholds (top-20 match ≥ 90%, overall ≥ 40%, count
  bands), prints a match report, writes atomically (temp+rename), seconds of
  runtime. One transient upstream 5xx fails the whole run (no retry today).
- GitHub Actions candidate facts to verify in exploration: free for public
  repos; `schedule:` cadence vs arena vote-cutoff freshness (text cutoff moves
  ~daily, OR prices less often); `GITHUB_TOKEN` needs `permissions: contents:
  write` to push from a scheduled workflow; a push from Actions to main **does**
  trigger the CF git deploy (verify — that would need **no CF secrets at all**);
  failure visibility (email on red run) and the slow-failure mode: arena name
  drift over weeks → match rate decay → override backlog grows silently until a
  threshold trips.
- Local Linux server candidate: cron + clone + `python3` + git push (SSH key);
  same flow, self-hosted; failure visibility is worse unless something mails
  the owner.
- The core design question is review semantics, not transport: auto-commit to
  main (hands-off, drops the diff-review step) vs cron opens a PR per run
  (owner merges after reviewing the data diff — preserves the discipline, costs
  a click; CF deploys on merge) vs hybrid (auto-commit only when the match
  report is clean by policy, else PR). Cadence, failure alerting, and
  `overrides.json` maintenance over time are the secondary questions.

### B11 — Custom cross-index (weighted meta index)

Owner's idea (verbatim intent): once many indexes are implemented, build our own
cross-index — a custom-weighted meta index across all of them; analyze which
indexes go in, which don't, and the weighting.

**Preliminary evidence (in-session, 2026-09-16):**

- This item is downstream of **B2** (Epoch AI: 85 benchmarks, 121/154 models,
  zero new fetch beyond one zip), **B5** (OR-syndicated `benchmarks` object,
  currently dropped by `update.py`: LMArena `design_arena` per-category elos on
  119/154 + Artificial Analysis intelligence/coding/agentic indices on 91/154 —
  zero fetches), and **B6** (11 arena boards; 108/154 models have ≥1 other-board
  Elo). Nothing is buildable until at least two of those exist.
- The hard problem is settled by B6's findings: per-board Elo scales are **not
  comparable on one axis** (text #1 ≈ 1505.7, vision #1 ≈ 1309.5, webdev #1 ≈
  1800.3, search #1 ≈ 1257.3) — any meta index must normalize components first
  (rank-percentile vs min-max vs z-score), and benchmark scores carry their own
  scales (Epoch metadata has `scale`/`random_baseline`/`score_ceiling`).
- Candidate component inventory to analyze in the exploration: text Elo
  (154/154, the anchor), per-board elos (5 chat boards, 108/154), Epoch
  benchmarks (85, 121/154, multiple effort variants per model×benchmark —
  002 B2 open question 1), AA indices (3, 91/154), design-arena category elos
  (up to 18 categories, 119/154).
- Open design space for the exploration: normalization method; which components
  and what weights (equal / owner-tunable sliders / presets like "quality",
  "coding", "agentic"); missing-component policy (coverage is 91–121/154, so
  partial vs require-all matters); where it displays (new panel mode? y-axis
  swap? B3 panel content?); whether the Pareto frontier recomputes over the meta
  score or stays Elo-based; provenance (per-component scores visible in
  tooltip/panel); and the index recipe as a committed config (weights editable
  in one file, recipe versioned into `meta.json`).
- Sequencing: exploration can be design-only now; the plan doc graduates after
  the anchor (text Elo) plus at least one additional index is in the data layer.

### B12 — Open-models selector (open weights / fully open source)

A selector/filter for open models. Owner's explicit question: **how many
licenses are there?**

**Preliminary evidence (measured in-session from committed data, 2026-09-16):**

- **Arena license strings: 39 distinct values** over the 402 arena entries;
  **18 distinct values** over the 154 joined models. The vocabulary is
  long-tail and inconsistent: two Apache spellings ("Apache 2.0" ×32 and
  "Apache-2.0" ×1 joined), two Gemma spellings ("Gemma" ×3, "Gemma license" ×1),
  six Llama-family spellings ("Llama 3 Community", "Llama 3.1 Community",
  "Llama 3.2", "Llama-3.3", "Llama 4", "Llama"), plus org-branded licenses
  ("Qwen", "Kimi K3 license", "MiniMax Community License", "Modified MIT",
  "MRL", "Gemma", …). Raw string equality is not a filter — a curated
  classification map over the 18 joined values is the unit of work (override-
  style: new values surface in the match report).
- Joined-set distribution (154 models): Proprietary 75, Apache 2.0 32, MIT 21,
  Modified MIT 7, Gemma 3, CC-BY-NC-4.0 3, one each of the other 12 → a binary
  open/proprietary split is 79/75; a three-tier permissive/community/NC split
  needs the map.
- Sources: arena `license` is the only license field committed today (18 values
  on the joined set; 402/402 non-null in `arena.json` per 002 B3). The
  OpenRouter API has **no** license field (002 B5 measured the full key union).
  OR's `hugging_face_id` (76/154, open-weight models only) is dropped by
  `update.py` today; the HF API is verified live this session —
  `huggingface.co/api/models/{id}` `tags` carry a clean machine-readable
  `license:apache-2.0` (plus parameter counts, 002 B5 item 7) — a cross-check
  source for the 76 models with an HF id.
- Taxonomy for the owner: "open weights" (weights public, any license — includes
  NC and community licenses) vs "fully open source" (permissive, OSI-style:
  Apache/MIT/CC-BY) vs the middle (community: Llama Community, Gemma, Qwen,
  NVIDIA Open Model — non-OSI, often commercially usable). The selector could be
  a 3-state control or a multi-select.
- Feasibility shape: client-side filter following the vision-filter precedent
  (hide + frontier recompute, 002 B1); data-side = one curated license-class
  map (18 values, maintained like `overrides.json`) plus an optional one-line
  `hugging_face_id` carry-through in `update.py` (002 B5 plumbing) for
  cross-checks and HF links.

### B13 — Open survey: other considerations

Owner's question: what other considerations, like the ones opened in 002, should
we consider? The exploration should produce a ranked candidate list, each with
value/effort, deduplicated against B1–B12.

**Preliminary candidates (context for the exploration, not findings):**

- Data-freshness surface: `meta.fetched_at` shows in `#stamp` and the footer,
  but there is no staleness signal — if B10 lands, a "data is N h old" badge
  becomes user-visible value; per-source vote-cutoff dates are not in `meta.json`
  today.
- Shareable state: mode/filters/search are not in the URL — "Pareto of OpenAI
  gpt-5.x" is currently shareable only as a screenshot; composes with B1/B7.
- Export of the current filtered set (CSV/JSON via client-side Blob) — cheap,
  and the human-facing half of B8's "API" ask.
- OG/meta tags + favicon for link previews (what the title currently resolves to
  is unverified); adjacent to B9's branding.
- Monitoring / dead-man's switch on data freshness — the operational shadow of
  B10.
- `update.py` fetch resilience: single fetch, no retry, no timeout budget —
  fine by hand, annoying under cron (feeds B10).
- Cache headers on the data JSONs: live responses carry `max-age=0,
  must-revalidate` — deliberate or default? Longer `max-age` + ETag revalidation
  is the standard static-CDN shape.
- Accessibility / mobile (chart + filter bar on a phone).
- i18n (ruled out in 002's out-of-scope — revisit only if the audience grows).

## Out of scope (for this backlog)

- Backend beyond a minimal same-worker `fetch()` handler (B8), new deploy
  target, new chart library, i18n, PWA.
- Reopening 001's settled decisions (A1–A11) — except where an item explicitly
  amends one (B10 amends the "manual updates only" convention; that amendment is
  an owner decision at review, not a silent change).

## Definition of done

- [ ] Owner reviews and approves this doc (process + item scoping).
- [ ] Exploration findings appended per item (one research-only sub-agent per
      item).
- [ ] Each surviving item graduates to its **own** `plans/00N-*.md` plan doc
      (one plan per examination; merges only by explicit owner decision).
- [ ] Each plan is owner-reviewed; implementation starts only after agreement,
      in the owner-chosen order, following 001's commit-per-step discipline.
