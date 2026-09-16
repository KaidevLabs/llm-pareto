# 002 — Exploration backlog (dashboard)

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**

Source: owner's post-001 ideas (2026-09-16). Per 001's closing note, follow-ups
start a new plan doc — this is that doc: a backlog plus the process to work it.

## Process (how this backlog gets worked)

1. **Explore** — per item, one sub-agent task (research only, no code) maps the
   possibilities:
   - feasibility on the current stack (static site, ECharts, committed JSON, no backend)
   - evidence: which data sources actually exist (e.g. which lmarena leaderboards,
     which public benchmark sets), measured, not assumed
   - design options as a consequences ledger (what it simplifies / complicates),
     not a pre-baked solution
   - rough effort (low/med/high) and dependencies on other backlog items
   - output: a short findings section appended to this doc
2. **Plan** — each surviving item becomes its own numbered plan doc
   `plans/00N-<slug>.md` in the 001 style (settled decisions table, steps,
   DoD), grounded in the exploration findings.
3. **Review** — owner reviews each plan by hand; nothing is implemented until a
   plan is agreed in a review session. Plans execute in owner-chosen order;
   items may be dropped, merged, or reordered at review.

## Backlog (order below is not priority)

### B1 — Filter by org, and within org by model family
Improve the filter bar beyond the current price-mode / ratio / spread / vision /
frontier set. Owner's extension (2026-09-16): can we have it **by org, then
inside org by model family, with a dropdown that shows that info** — i.e. the
org → family hierarchy as the filter control. "Family" itself is still
undefined and needs discussion: OR org prefix, model family (gpt-5.x,
gemma-4-…?), or both. Per-model selection is a different mechanic
(multi-select vs search) and may fold in here or stay separate.

**Preliminary evidence (in-session, 2026-09-16, from live
`combined.json` — context for the exploration task, to be validated and
extended by it, not a completed exploration):**

- Feasibility: the org dimension is already clean in the data: 23 orgs,
  unified via `arena_org` (OR-id-prefix fallback) — same value that
  already drives bubble color (app.js:26-44). Org sizes on current
  data (154 models): OpenAI 28, Alibaba 26, Google 18, Anthropic 15,
  Z.ai 13, Meta 11, Mistral 7, MiniMax 6, Moonshot 5, SpaceXAI 5,
  DeepSeek 5; the other 12 orgs have 1-3 models each.
- UI shape under consideration: one `<select>` in the filter bar,
  `<optgroup>` per org with the family options inside — "org, then
  family within org" as a single dropdown. Fully client-side, same
  pattern as the vision filter.
- Family derivation is the core open question: naming conventions
  differ per org (version in token 2 — OpenAI/Google/Z.ai/xAI; tier in
  token 2 — Anthropic opus/sonnet/haiku; version glued to token 1 —
  qwen3.5). Mechanical rules tested against the real slugs:
  - R1 first 2 tokens: deterministic, zero maintenance, but granular
    (OpenAI → 16 "families": gpt-4, gpt-4.1, gpt-4o, gpt-5.1, gpt-5.2, …;
    qwen → 22)
  - R2 = R1 + singletons→1st token: inconsistent
    (OpenAI → gpt, gpt-4, gpt-4.1, gpt-4o, gpt-5, gpt-5.2, gpt-5.4,
    gpt-5.6, gpt-oss, o1, o3, o4)
  - R3 longest shared prefix: too coarse (OpenAI → gpt(24);
    Anthropic → claude(15))
  - R4 per-org curated map: best human intuition, needs a touch-up when
    a new model line ships
- Leaning (to be challenged by the exploration): R1 baseline + per-org
  curated map where the baseline demonstrably fails (at least OpenAI,
  Alibaba) — computed client-side in app.js (display concern; no
  update.py/data changes, consistent with the "filters work fully
  client-side" DoD).
- Open questions for the exploration: (1) family rule: R1 / R4 /
  hybrid — and per-org, which groupings match human intuition;
  (2) hide vs dim non-matching models — leaning hide, consistent with
  the vision filter, so the frontier recomputes within the selection
  (e.g. "Pareto of OpenAI gpt-5.x"); (3) one dropdown with optgroups
  vs two linked selects (org → family).

### B2 — Benchmarks info + benchmark filter
Add other benchmark data to the joined dataset and expose a benchmark-driven
filter. Exploration should survey which public benchmark sources are
cross-referenceable by model name (same join problem as arena→OR: expect
fuzzy matching + overrides) and what a "filter by benchmark" even means
UI-wise (rank threshold? show score as dimension?).

### B3 — Click a bubble → model details on the right
Currently a bubble click does nothing beyond tooltip. Side panel with the
model's detail info. Exploration should enumerate what fields we already have
(arena side: Elo, CI, votes, org, license, context, arena $/M; OR side: price
in/out, context, modalities, variants) vs what new data would be needed.

### B4 — Logos instead of bubbles
Explore vendor/model logos on the chart instead of bubbles. The exploration
must answer the open question first: what are bubbles currently encoding —
size = votes, color = org — and what is lost if they are replaced (or kept
alongside logos). Also: logo source (OR model pages? per-org assets? where does
a static site fetch them from?).

### B5 — Other cross-referenceable data
Open survey: what else can be joined onto arena × OpenRouter (pricing over
time? context-window claims vs reality? context length we already keep?
modality coverage we partly have?). Same constraints: name-based join,
committed JSON, fail-fast validation.

### B6 — Other lmarena leaderboards
The data layer only scrapes `lmarena.ai/leaderboard/text` (RSC payload).
Exploration should inventory the other leaderboards (vision, webdev, …),
verify their payload shape is the same `self.__next_f` surface, and define how
multi-leaderboard data coexists in the join (arena Elo becomes per-board;
frontier semantics must be decided).

### B7 — Search input box
Owner's request (2026-09-16): **a search input box that highlights the models
on the chart matching the typed text**. The box lives in the existing filter
bar; typing filters the highlight live. The exploration must settle how
"highlight" behaves against the rest of the chart and how it composes with
B1 (org/family filter) and B3 (click → details).

**Preliminary evidence (in-session, 2026-09-16, from live `combined.json`
and `app.js` — context for the exploration task, to be validated and
extended by it, not a completed exploration):**

- Feasible, low effort: roughly 60-80 lines across `app.js` +
  `index.html`; no data-layer or `update.py` changes.
- Searchable surfaces per model (actual fields): `or_name`
  (e.g. "Anthropic: Claude Opus 4.6"), `or_id`
  (anthropic/claude-opus-4.6), `arena_org` ("Anthropic"), `arena_model`
  ("claude-opus-4.6"), plus the `arena_variants` list. A case-insensitive
  substring over these covers the likely queries ("opus" → all Claude
  Opus, "gpt-5" → the gpt-5 line, "anthropic" → via org).
- The implementation pattern already exists in-repo: client-side `state`
  + full re-render per change (app.js:14-20, 328, 381-423), the ratio
  slider's live `input` listener is the precedent for a text box
  (app.js:407), and the dim style drops straight into the model series'
  `itemStyle` (app.js:236-242). The filter bar is `nav.filters`
  (index.html:249); a text input needs ~15 lines of CSS to match the
  dark theme.
- Leaning (to be challenged by the exploration): **soft highlight — dim
  non-matching points (~alpha 0.12-0.15, position/size/colors kept),
  do not hide them** — matches the owner's "highlight" wording; the
  Pareto frontier stays global and keeps its meaning while matches are
  inspected. Deliberate contrast with B1, which is a categorical hard
  filter (hides); the two compose — search dims within the B1-filtered
  set. Hide semantics make the frontier recompute over the (often
  small) match set, which can degenerate to a trivial line.
- Open questions for the exploration: (1) highlight vs hide — and the
  frontier semantics that follows (global vs recomputed); (2) match
  semantics — plain substring over or_name/or_id/org/arena_model, or
  multi-token AND, or anything else; (3) no-match feedback — a small
  "n matches" count next to the box, "0 matches" state, or nothing;
  (4) match styling — plain full-color vs an emphasis ring, dim
  strength; settle by a quick manual A/B feel-out; (5) interaction with
  B1/B3 (decide together at review).

## Out of scope (for this backlog)

- Backend, new deploy target, new chart library, i18n, PWA.
- Reopening 001's settled decisions (A1–A11).

## Definition of done

- [ ] Owner reviews and approves this doc (process + item scoping).
- [ ] Exploration findings appended per item.
- [ ] Each surviving item has a `plans/00N-*.md` plan doc.
- [ ] Each plan is owner-reviewed; implementation starts only after agreement,
      in the owner-chosen order, following 001's commit-per-step discipline.
