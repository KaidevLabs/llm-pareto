# 002 — Exploration backlog (dashboard)

Date: 2026-09-16. **Status: ARCHIVED (2026-09-16)** — commits: 4e802e8 (doc +
preliminary evidence); step-1 findings appended the same day (91233c0, together
with the graduated plan docs 004–010); all items graduated to their own plans
(004–010) and archived in the closing commit. This doc is the evidence base,
linked from each plan.

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

**Plan:** `plans/004-org-family-filter.md` (draft, pending owner review).

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

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line: fully
client-side; every mechanical family rule fails on at least half the top orgs
(R1: OpenAI → 18 families incl. "o1-2024"; R3: catch-alls "gpt"=7,
"minimax"=6), so a hand-curated `or_id`-keyed map for the 11 large orgs + R1
fallback is the only grouping that matches human intuition; the
frontier-recomputes-on-filter semantics are already established by the vision
filter (hide + recompute).

**Feasibility.** Fully client-side on the committed-JSON/ECharts stack; no
`update.py` or data changes. `arena_org` exists on all 154 `combined.json`
rows (set at update.py:313 from arena `modelOrganization`, OR id-prefix
fallback never used — 0 empty) and already drives bubble color
(app.js:26-30, 231). A family map is a plain JS object keyed by `or_id`
(stable across arena renames), built once in `main()` after fetch
(app.js:425-449), feeding a `familyOf(d)` helper into `filtered()`
(app.js:68-71). The filter bar (index.html:249-267) is `flex-wrap`, so one or
two `<select>`s slot in without layout change; ~15 CSS lines to match the dark
theme. ECharts is untouched — filtering happens before `chartOption`
(app.js:298-300) and the existing full re-render path (app.js:328-345) already
serves any state change. O(n²) frontier at n≤154 is trivial (~23k comparisons).

**Evidence.**
- Org dimension: 23 orgs over 154 models — OpenAI 28, Alibaba 26, Google 18,
  Anthropic 15, Z.ai 13, Meta 11, Mistral 7, MiniMax 6, Moonshot 5, SpaceXAI 5,
  DeepSeek 5; 12 remaining orgs have 1–3 (Cohere 3, Xiaomi 2, ten singletons).
  Labels are arena-sourced: all five `x-ai/*` rows carry `arena_org`
  "SpaceXAI"; Z.ai is "Z.ai".
- Current filter mechanics: the vision filter **hides** — `filtered()`
  (app.js:68-71) returns a reduced array, no dimming — and the frontier
  **recomputes over the filtered set** (`renderPanel` app.js:298-300 →
  `paretoFrontier(pts)`). Consequences already in force for any filter:
  bubble-size min/max rescales per filtered set (app.js:156-158), count text
  follows (app.js:324-325), while `ORG_COLOR` is built once from all data
  (app.js:445) so colors stay stable. New filters compose as a conjunction
  inside `filtered()`.
- R1 (first two `arena_model` tokens), measured: OpenAI → 18 families, 11
  singletons — date tokens leak in (`o1`→"o1-2024", `o3`→"o3-2025", while
  `o3-mini` splits off separately); flagship `openai/gpt-5` (arena
  `gpt-5.3-chat-latest`) lands in "gpt-5.3" while `gpt-5-mini`/`gpt-5-nano`
  form the "gpt-5" family. Alibaba → 23 families of 26, 18 singletons —
  `qwen3.5-122b`/`-27b`/`-35b`/`-397b`/`-flash`/`-max` all split on the size
  token. MiniMax → 6 singletons (`m1, m2, m2.1, m2.5, m2.7, m3`). Z.ai →
  `glm-4.5` vs `glm-4.5v` and `glm-4.6` vs `glm-4.6v` split (the `v` glues to
  the version token). Google → `gemini-3.6/3.7/3.8-flash` are three singleton
  families of the same flash line. R1 *works* where token 2 is the product
  line: Anthropic (opus 7 / sonnet 4 / fable 2 / haiku 1 / claude-3 1) and
  Mistral (small 3; medium, large, ministral, mixtral 1 each).
- R3 (per-slug max shared token-prefix with any same-org peer), measured:
  correct where R1 is over-granular (Alibaba `qwen3.5`=6, `qwen3.6/3.7/3.8`=2
  each) but catch-alls elsewhere — OpenAI "gpt"=7 {gpt-3.5-turbo, gpt-4-turbo,
  gpt-4.5-preview, gpt-5.1, gpt-5.3, gpt-5.5, gpt-6-astra}, Z.ai "glm"=7
  {glm-5, glm-5.1, glm-5.2-max, glm-5v-turbo, glm-4.6, glm-4.6v, glm-4.5v},
  MiniMax → all 6 "minimax". Also not a clean partition: the key is per-slug
  and asymmetric, so two slugs sharing a prefix can land in different
  families.
- R4 hand-curated (keyed by `or_id`), validated 1:1 against current data:
  OpenAI GPT-5.x 13 / GPT-4.x 8 (incl. gpt-3.5-turbo) / O-series 4 / GPT-OSS 2
  / GPT-6 1; Alibaba Qwen3 open-weights 8 / Qwen3.5 6 / Qwen2.5 3 /
  Qwen3.6, 3.7, 3.8 (2 each) / Qwen3-VL 2 / Qwen legacy 1 (`qwen-plus`);
  Google Gemini 3.x 9 / Gemini 2.5 3 / Gemma 3 3 / Gemma 4 2 / Gemma 2 1;
  Anthropic Opus 7 / Sonnet 4 / Fable 2 / Haiku 2 (claude-3-haiku counted as
  Haiku); Z.ai GLM-4 7 / GLM-5 6; Meta Llama 3 5 / Muse 4 / Llama 4 2;
  Mistral small 3 + four singletons; MiniMax M 6; Grok 4 5; Kimi K2 4 / K3 1;
  DeepSeek V 4 / R1 1. Totals: 38 family options for the 11 curated orgs,
  ~12 more for small orgs → ~50 options under 23 optgroups plus "All".
- Naming drift on non-exact matches (123 exact / 20 prefix-base / 8
  prefix-variant / 3 fuzzy): `qwen/qwen3-max` matches arena
  `qwen3.5-max-preview`, so a "Qwen3-Max" bubble sits in Qwen3.5;
  `openai/gpt-5` → arena `gpt-5.3-chat-latest` (lands in GPT-5.x, fine).
  Keying by `or_id` while family *names* follow the arena identity (the Elo
  the bubble represents) is the consistent choice.
- Frontier semantics under filtering (3:1 blend): global frontier = 10 pts
  (claude-fable-5, claude-opus-4.6, muse-spark-1.2, gemini-3.8-flash,
  glm-5.3-flash, gemma-4-31b-it, deepseek-v4-flash, qwen3-30b-a3b-instruct,
  gpt-oss-120b, gpt-oss-20b). Recomputed: OpenAI GPT-5.x (13 pts) → 4 (gpt-5.6-sol,
  gpt-5.1, gpt-5.6-luna, gpt-5-nano — mid-tier gpt-5.1 leads the in-set
  tradeoff); Alibaba (26) → 8; Anthropic (15) → 6; Gemma 3 (3) → all 3
  (trivial); 1–3-model orgs degenerate to "frontier = everything".

**Options.**
- **(a) One `<select>`, `<optgroup>` per org, family options inside** (All on
  top; per-org "All <org>" as first option, since native selects can't select
  an optgroup label).
  - Simplifies: one control; the org→family hierarchy is literally visible as
    requested; org-first navigation with counts in option labels
    ("GPT-5.x · 13"); composes with price mode/ratio/spread/vision/frontier
    via the same `filtered()` conjunction; collapsed state shows the selected
    family text.
  - Complicates: ~75 options → long native popup scroll; org label drops out
    of the collapsed state (only the family shows); "All <org>" duplicates the
    optgroup label; ~15 CSS lines for the dark-theme select; families of an
    org are undiscoverable until that org's group is opened.
- **(b) Two linked selects: org (All + 23) → family (All families + ≤8,
  disabled when org = All).**
  - Simplifies: both lists short; collapsed state self-describes the active
    filter at both levels ("OpenAI" + "GPT-5.x"); no optgroup tricks;
    trivially extensible (counts, "inverted" mode later).
  - Complicates: a sixth control in a bar that has five (flex-wrap exists at
    index.html:64-70 but a wrapped row on desktop reads as a layout
    regression); org change must reset family; "All orgs" leaves a dead
    disabled control.
- **(c) Org select only now; family added later in the same slot (visible
  only when org ≠ All).**
  - Simplifies: 24-option control ships ~80% of the ask immediately; the
    family rule — the real risk — gets reviewed after the org filter has been
    live a while.
  - Complicates: two shipping events; defers the hierarchy-in-one-dropdown ask
    the owner made.
- **Hide vs dim** (orthogonal to a/b/c): hide = the existing vision-filter
  pattern — frontier recomputes, bubble scale rescales, count updates;
  "Pareto of only OpenAI GPT-5.x" is the literal reading, but global context
  (where the subset sits vs the rest) is gone. Dim = keep all 154,
  non-matching at alpha ~0.12–0.15 via `itemStyle` (app.js:236-242; pattern
  already sketched for B7) — context and the global frontier survive, but you
  now maintain two visual languages (hidden vs dimmed) and must decide
  tooltip/frontier-dot behavior for dimmed points.

**Open questions.**
1. Approve the R4 groupings as listed? Specific calls: gpt-3.5-turbo inside
   GPT-4.x; "Qwen3 open-weights" as one 8-model family vs R1's per-size split;
   Gemini 3.x as one 9-model family vs per-minor-version; GLM-4 (7) / GLM-5
   (6) as single buckets.
2. Hide or dim non-matching models — and does B1's choice bind B7's (B7 leans
   dim-for-search, which composes cleanly with B1-hide: search dims within
   B1's hidden set).
3. Frontier under an active filter: recompute over the selection, or overlay
   the global frontier as a ghost line for reference?
4. UI shape: (a) single select with optgroups, (b) two linked selects, or
   (c) org-only first?
5. The 12 small orgs: one family = the org, or list models directly (Cohere
   Command 3, Xiaomi MiMo 2)?
6. Where does the R4 map live — a const in app.js vs
   `public/data/families.json` fetched beside combined.json — and how does a
   new `or_id` not in the map render (R1 fallback vs an "Other" bucket under
   its org)?
7. Should org also be selectable by clicking a bubble's color/legend (no
   legend interaction exists today), or is the dropdown the only entry point?

**Effort & deps.** Low–med. ~50–80 lines in app.js (two `state` fields,
`familyOf()` + R4 map, `filtered()` predicate, select build in `main()` and a
`change` listener in `bindFilters()` at app.js:381-423) plus ~10–15 lines in
index.html (markup + CSS). No `update.py` or data changes, no new
dependencies. No hard dependency on other backlog items. Interactions:
**B7 (search)** — decide hide/dim jointly so B7's "dim within the B1-filtered
set" composition holds; **B3 (details panel)** — the panel should render org +
family through the same `familyOf()` helper; B4 (logos) — none. Ongoing cost:
the R4 map needs a touch-up whenever a new model line ships — an unlisted
`or_id` silently falls back to R1/Other until then, which is the price of
keeping family logic out of the data layer.

### B2 — Benchmarks info + benchmark filter

**Plan:** `plans/005-benchmarks.md` (draft, pending owner review).

Add other benchmark data to the joined dataset and expose a benchmark-driven
filter. Exploration should survey which public benchmark sources are
cross-referenceable by model name (same join problem as arena→OR: expect
fuzzy matching + overrides) and what a "filter by benchmark" even means
UI-wise (rank threshold? show score as dimension?).

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line:
Epoch AI's static benchmark zip (`epoch.ai/data/benchmark_data.zip`, 85
benchmarks, updated daily, CC-BY) covers 121/154 of our joined models with
near-exact slug joins and should be the single primary source for B2, with
LiveBench's static CSVs as the freshest secondary.

**Feasibility.** Feasible on the current stack with no new runtime
dependencies — the burden lands entirely in `update.py`'s data pipeline, not
the site. Today it fetches exactly two sources (update.py:23-24); B2 adds a
third (a 2.3 MB zip of CSVs, stdlib `urllib`+`zipfile`+`csv`), a second
normalization path (benchmark model versions use `_` separators and extra
effort suffixes the current `normalize()` at update.py:178 doesn't strip), a
second override namespace, a new output file, and a new validation block. The
client side is cheap: `app.js` already re-renders ECharts from `filtered()`
(app.js:68) on every filter change and fetches `combined.json`+`meta.json`
(app.js:428-429) — a benchmark filter is one more state field and a third
fetch (or a fold into `combined.json`). Honest caveat: a *fuzzy* benchmark
join is strictly harder than arena→OR because the identifier namespaces are
three-way (OR slug ↔ arena name ↔ each source's own naming) and scores are
only as good as the join; every source measured needs at least a small
per-source pre-normalization plus overrides for the frontier names. The
fail-fast culture is preserved naturally: the new join validates the same way,
with coverage floors and score-range sanity checks.

**Evidence.** All fetch methods verified by actually downloading and parsing
the data on 2026-09-16.
- **Epoch AI** (recommended primary). `https://epoch.ai/data/benchmark_data.zip`
  (link from `epoch.ai/benchmarks/use-this-data`, displayed "Updated Sep. 16,
  2026" — i.e. today; CC-BY). 85 per-benchmark CSVs (10,745 rows) +
  `benchmark_metadata.csv` (81 benchmarks with `scale`, `random_baseline`,
  `score_ceiling`, `superseded_by`). Columns: `Model version, Score, Release
  date, Organization, Country, Training compute, R1/R2/R3, Shots, Source,
  Source link, Notes, id`. Identifier format: OR-slug-style with `_`-joined
  effort/context suffixes — `claude-opus-4-6_high`, `gpt-6-astra_xhigh`,
  `gemini-3.8-flash_high`, `claude-fable-5-1_xhigh`, `qwen3.8-max-0902_xhigh`,
  `gpt-5.6-sol_promax`, `claude-3-7-sonnet-20250219_12K`. Spot-joined against
  our 154 `combined.json` using `update.py`'s own `normalize()`/`match_arena()`
  after `_`→`-`: **121/154 exact (79%)**; the 33 misses are mostly non-frontier
  (old qwen/mistral/cohere/llama-4) plus a few real gaps
  (`meta/muse-spark-1.3` — Epoch stops at `muse-spark-1.2`, `tencent/hy3`,
  `z-ai/glm-5v-turbo`, `google/gemini-3-pro-image`). Frontier fully present:
  `claude-fable-5`, `claude-opus-4.6/4.7/4.8/5`, `claude-sonnet-5`,
  `gpt-6-astra`, `gpt-5.6-luna/sol/terra`, `gemini-3.6/3.7/3.8-flash`,
  `glm-5/5.1/5.2/5.3`, `grok-4.3/4.5/4.6`, `kimi-k3`,
  `deepseek-v4-pro/flash`, `minimax-m3`, `step-3.7-flash`. Freshness: 40
  benchmarks have evals dated 2026-06+, latest `Release date` **2026-09-03**
  (gpqa_diamond, otis_mock_aime, frontiermath v2, hle, scicode, deepswe,
  frontierswe, arc_agi, cursorbench, frontiercode, webdev_arena).
  `claude-fable-5` alone has 36 benchmarks. Not verified: exact refresh
  cadence (one observation) and the harness settings behind `_external` rows
  (e.g. `terminalbench_external` is an older snapshot than tbench.ai's live
  board).
- **LiveBench** (recommended secondary). Static files in the GitHub Pages repo
  `LiveBench/livebench.github.io`, served at `livebench.ai`:
  `https://livebench.ai/table_<YYYY_MM_DD>.csv` (verified 200; 57 models × 24
  task columns, no overall column), `categories_<date>.json` (tasks→categories,
  overall computable client-side), `cost_<date>.csv` (per-task cost). 11
  releases 2024-06-24 → **2026-06-25** (~3 months old; irregular cadence).
  Identifier format: arena-style slugs with long config tails
  (`claude-opus-4-6-thinking-auto-high-effort`, `gpt-6-astra-max`,
  `muse-spark-1.3-xhigh`). Spot-join: **43/154** with the existing pipeline
  plus stripping `-effort/-thinking/\d+k` tails. Risk: `LiveBench/new-livebench`
  ("redesigned LiveBench leaderboard (private preview)") pushed 2026-09-10 —
  format may change.
- **SWE-bench** (swebench.com). Leaderboard embedded in the homepage as
  `<script type="application/json" id="leaderboard-data">` (~2.4 MB,
  verified). 5 boards: Verified (180 results, latest **2026-02-26**), Lite
  (84), Multimodal (22), Multilingual (13), Test (24). Fields: `name, agent,
  model_org, model_display, resolved, date, cost, instance_cost,
  per_instance_details, reasoning_effort`. Names: human display names with
  tier-last word order ("Claude 4.6 Opus", "GPT 5.2 (high)"). Join with the
  existing pipeline: only **8/154** (the `normalize()` space-collapse at
  update.py:181 turns "GPT 5.2" into `gpt5-2`). The Verified top-10 are all
  models we have — a per-source override file buys high frontier coverage, but
  the board is **~7 months behind the frontier**.
- **BFCL / Gorilla** (gorilla.cs.berkeley.edu/leaderboard.html).
  `https://gorilla.cs.berkeley.edu/data_overall.csv` (verified 200, 109 rows):
  `Rank, Overall Acc, Model, Model Link, Total Cost ($), Latency, …,
  Organization, License` + per-category accuracies. Names like
  `Claude-Opus-4-5-20251101 (FC)` join cleanly: **33/154**. Two known fuzzy
  mis-joins from the date-strip rule. ~9 months stale (manual updates). Unique
  dimension: function/tool-calling.
- **Terminal-Bench** (tbench.ai). Next.js; rows in the RSC payload of the
  homepage (same scrape technique as update.py:42). Board 4.0: 18 rows,
  latest **2026-09-03**; join key is the slug in
  `metadata.model_display.url`. Spot-join: 8/8 exact. Not verified: whether
  rows beyond the first page are in the HTML.
- **Aider polyglot** (aider.chat/docs/leaderboards). Static HTML table (139
  rows), per row includes the exact command (`aider --model openai/gpt-5`).
  Stale (newest rows 2025-10). Cut for v1.
- **BigCodeBench** (bigcode-bench.github.io). `results.json` (202 models),
  clean JSON keyed by model name. 2025-04 snapshot; 29/154. Cut for v1.
- **HuggingFace Open LLM Leaderboard**. Alive, clean API
  (`GET /api/leaderboard/formatted`, 4,576 models). Top is 2025-era open
  models; only ~2/154 of ours. Redundant with Epoch. Cut.
- **HELM (Stanford CRFM)**. Release JSON on GCS; frontier coverage stops
  ~2025-11. Cut.
- **Artificial Analysis**. Per-model pages carry ~30 benchmark score keys +
  pricing in the RSC payload; no public REST API. Viable cross-check, but
  ~154 HTML pages scraped per update — highest burden of the survivors.
- **Vals.ai**. Fresh agentic boards but only top-3 names per benchmark on the
  list page; no API. Cut for v1.
- **LMArena non-text boards** (B6 overlap): `lmarena.ai/leaderboard/*`
  301-redirects to `arena.ai/leaderboard/{text,vision,agent,document,search}`;
  same RSC `"entries":` payload format as the text board. Epoch already
  aggregates `webdev_arena_external` (fresh 2026-09-03) — B2 and B6 both claim
  "webdev Elo"; scope that in B6.

**Options.** *Sources.* (1) **Epoch only** — one zip, one join, one override
file; 121/154 coverage, 85 benchmarks incl. GPQA/FrontierMath/AIME/ARC-AGI/
SWE-bench-Verified/Terminal-Bench/LiveBench/HLE/SciCode. Consequences: +~200
lines in `update.py` (fetch zip, parse 85 CSVs, per-source normalize with
`_`→`-` + extra suffix strips, override file), new `benchmarks.json` output,
new validation block; risk: single vendor, unversioned zip format (mitigate by
validating structure), `_external` rows are Epoch's re-aggregates (cite as
such). (2) **Epoch + LiveBench** — adds per-task detail (24 tasks), its own
cost column, and an independent second opinion. Consequences: +1 fetch
(date-stamped URL, needs release-discovery), 2 join paths, 2 override
namespaces, larger committed JSON; benefit: fresher frontier scores than
Epoch's older external snapshots. (3) **Add SWE-bench Verified** as a
flagship coding number. Consequences: +1 embedded-JSON scrape, a
display-name→slug override table (10+ entries), users must learn its top entry
is 7 months older; only worth it if "SWE-bench Verified %" becomes a headline
stat. *UI.* (a) **Tooltip enrichment** — 4–8 benchmark scores in `tooltipHTML`
(app.js:126); near-zero complexity, but not a filter. (b) **Benchmark picker +
score-threshold slider** in `nav.filters` (index.html:249) — "GPQA Diamond ≥ 70"
hides the rest; needs per-benchmark scale handling (Epoch metadata
`scale`/`score_ceiling`), a policy for unscored models, threshold bounds
computed client-side; the most literal reading of "benchmark filter". (c)
**Y-axis swap** (Elo → selected benchmark score) — per-benchmark y-scale; the
Pareto frontier must be recomputed per benchmark or kept Elo-based with a
visible note; strongest feature, most semantic questions. (d) **Coverage
toggles** ("has a score on X") — cheapest real filter; stepping stone to (b).
*Data placement.* New committed `public/data/benchmarks.json` keyed by `or_id`
(fetched as a third file by app.js) rather than folding into `combined.json` —
keeps `combined.json` stable for B6; join happens in `update.py`, client does
a plain lookup. *Validation for a fuzzy benchmark join.* Mirror the existing
style (update.py:337): row-count band (5k–50k), benchmark-count band (≥60),
per-benchmark row floor (≥3), join coverage floor (≥70% of the 154, ≥100
absolute), per-score sanity check against metadata `random_baseline ≤ score ≤
score_ceiling`, freshness check (≥10 benchmarks ≥120 days old AND max
`Release date` within 90 days), and an unmatched-model-version list in the
match report for manual overrides (the arena flow at update.py:463-466).

**Open questions.**
1. Effort-variant policy: a model×benchmark has multiple rows (`_high`,
   `_max`, `_xhigh`, `_none`, …) — store max, a chosen default, or all with a
   UI picker?
2. Filter semantics for unscored models: hidden or dimmed/visible?
3. v1 scope: Epoch alone, or Epoch + LiveBench?
4. Is the y-axis swap in B2 or deferred (it changes what "frontier" means)?
5. Ownership of webdev Elo — Epoch's `webdev_arena_external` or B6's direct
   lmarena scrape?
6. Attribution: Epoch requires credit (CC-BY) — footer note or per-benchmark
   source badge?
7. Coverage target: is 121/154 (79%) acceptable, or chase the misses with a
   curated override file?

**Effort & deps.** Medium: data pipeline ~1–2 days (one zip fetch,
stdlib-only parsing, bounded per-source normalization +
`benchmarks-overrides.json`, one validation block), UI ~1 day for tooltip +
picker/threshold; y-axis swap adds ~half a day. Deps: none external (all
stdlib, all static). B5 reuses everything B2 builds (override-file pattern,
join-coverage validation, a `sources` entry in meta.json) — landing B2 first
is the cheap path for B5. B6 is the same RSC scrape as the text board and
directly overlaps Epoch's `webdev_arena_external`; if B6 adds per-board Elo
columns, B2's UI can consume the same shape — coordinate on the data file name
now. No A1–A11 decision is reopened: the new JSON is additive.

### B3 — Click a bubble → model details on the right

**Plan:** `plans/006-model-details-panel.md` (draft, pending owner review).

Currently a bubble click does nothing beyond tooltip. Side panel with the
model's detail info. Exploration should enumerate what fields we already have
(arena side: Elo, CI, votes, org, license, context, arena $/M; OR side: price
in/out, context, modalities, variants) vs what new data would be needed.

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line: fully
feasible client-side today with zero data changes (panel content already
exists in `combined.json` + a derivable `https://openrouter.ai/<or_id>` link),
with one-line `update.py` carry-throughs available for `modelUrl` and
arena-side $/M if richer content is wanted; no chart click handler exists yet,
so the work is a `chart.on("click")` hook plus a state field that coexists
cleanly with the re-render-per-change architecture.

**Feasibility.** Trivially feasible on the current stack: `combined.json`
already carries everything the panel needs, and the only field with no home
anywhere is the OpenRouter page URL, derivable client-side from `or_id`. The
only wiring required is a click handler on the persistent ECharts instances
(`app.js:312-314` init once, `setOption(opt, true)` at `app.js:315-318`) plus
a `state.selected` field and a render function. Adding new fields is a
one-line change in `update.py`'s `join()` dict (`update.py:300-323`) or
`parse_openrouter` (`update.py:130-155`), then `python3 update.py` regenerates
data.

**Evidence.**
- Arena-side field inventory (402 entries; measured non-null):
  - Carried into `combined.json` (`update.py:300-323`): `rank`→`arena_rank`
    (402/402), `rating`→`arena_elo` (402/402), CI bounds (402/402), `votes`
    (402/402), `modelOrganization`→`arena_org` (402/402), `license`→
    `arena_license` (402/402; top values: Proprietary 180, Apache 2.0 60, MIT
    47, CC-BY-NC-4.0 10), `modelDisplayName`→`arena_model`+`arena_variants`
    (402/402; 41/154 combined rows collapse >1 variant),
    `contextLength`→`arena_context_length` (268/402; 134/154 combined).
  - Dropped from arena side, with measured value: `modelUrl` (402/402
    non-null; 154/154 combined rows have one);
    `inputPricePerMillion`/`outputPricePerMillion` (304/402; 145/154 combined
    rows have arena-side $/M — arena's own reported pricing, e.g. $10/$50 for
    claude-opus-4-7); `rankLower`/`rankUpper` (402/402 — rank CI is dropped,
    only rating CI survives); `modelKey` (402/402, e.g.
    `claude-opus-4-7-thinking`); `releaseType` (3/402: pre_release×2,
    co_release×1); `pricePerImage` (0/402) and `pricePerSecond` (0/402) —
    keys exist but every value is null.
  - Context-length divergence: 24/134 rows have both `context_length` (OR) and
    `arena_context_length` present and different (e.g.
    `google/gemini-3-pro-image` OR 131072 vs arena 1048576;
    `anthropic/claude-sonnet-4.5` OR 1000000 vs arena 200000).
- OpenRouter API schema diff. Repo `openrouter.json` (351 models) keeps
  exactly 7 fields (`update.py:145-155`). Live API (fetched today) returns 443
  models before `update.py`'s filter — 18 `~` aliases + 74 `:batch` dropped
  leaves exactly 351, so the repo snapshot matches the live API. Ignored
  per-model fields (presence of 443): `canonical_slug` (443),
  `hugging_face_id` (184), `created` (443, epoch secs, 2023-05→2026-09),
  `description` (443, median ~211 chars), `knowledge_cutoff` (184),
  `expiration_date` (4), `alias_target` (18), `reasoning` (311:
  `supported_efforts`/`default_effort`), `benchmarks` (248, e.g.
  `artificial_analysis.intelligence_index`), `links` (443 → per-model
  endpoints API), `per_request_limits` (0), `default_parameters`,
  `supported_voices` (0). `architecture`: only `input_modalities`→`vision`
  kept; ignored are `modality` (120 models with file/video/audio inputs),
  `output_modalities` (11 image-output, 4 audio-output), `tokenizer`,
  `instruct_type`. `top_provider`: only `context_length` kept; ignored
  `max_completion_tokens` (443), `is_moderated` (124). `pricing`: only
  `prompt`/`completion` kept; ignored `input_cache_read` (276),
  `input_cache_write` (82), `web_search` (164), `image` (30), `audio` (33),
  `image_output` (9), `audio_output` (2), `internal_reasoning` (31),
  `overrides` (68 — length-tiered pricing). `:free` variants are *not*
  filtered by `update.py` (20 exist) but none matched arena, because
  `normalize()` strips `:free` (update.py:186) and the lookup keeps the
  shorter id on collision (update.py:214-216).
- Current click behavior: no click handler on any chart — the only listeners
  are filter controls (`app.js:383,392,401,407,413`) and window resize
  (`app.js:418`). Point-level interaction is tooltip-only: `chartOption`
  tooltip at `app.js:252-260` with `confine: true` and
  `formatter: (p) => (p.seriesName === "models" ? tooltipHTML(p.data) :
  p.tooltip)`; `tooltipHTML` (`app.js:126-153`) already assembles name, id,
  rank, elo ± CI, votes, blended/in/out prices, org, license, context,
  vision, match method/ratio/override flag. The "models" scatter
  (`app.js:225-246`) embeds the full row as `d` (line 234) with
  `value: [price, elo]` (line 92); the frontier line (`app.js:201-223`)
  resolves its tooltip via the renderPanel-local `frontier` array (line 218);
  the "spread" custom series is `silent: true` (app.js:165). Hook point:
  `renderPanel` — `charts[id]` is created once (312-314) and
  `setOption(opt, true)` fully replaces the option on every state change
  (315-318), but handlers registered with `.on("click")` survive re-renders;
  the `frontier` array (line 300) is local and would need stashing in module
  state to resolve frontier-line clicks. All filters funnel through
  `render()` (app.js:328-345) → `renderPanel(active)`; the detail panel is
  orthogonal to the `filtered()`/`pointsFor` pipeline, so a `state.selected`
  (keyed by `or_id`) + separate `renderDetails()` renders independently.
  Layout: `#main` is `grid-template-columns: 1fr` (index.html:106) with one
  visible `.panel` at a time; the resize loop (app.js:342-344) already
  resizes visible charts after each render.

**Options.** *Panel shape.* (a) **Fixed right rail** (~300-360px column in
`#main`'s grid). Simplifies: persistent across mode switches, no chart
occlusion, room for links/variant lists, stable target for B7, no close
affordance needed. Complicates: chart loses ~300px width (grid change +
resize; the log x-range and bubble density shift visually); must define
behavior when B1 filters the selected model out; cramped on narrow
viewports. (b) **Overlay drawer** (absolutely positioned over the chart's
right edge, ~340px, close button + click-outside-to-close). Simplifies: zero
layout change, no chart reflow, trivially coexists with B1, smallest CSS
diff, easy close affordance. Complicates: occludes the chart's right side
(high-price points hide); two simultaneous focus states (hover tooltip + open
drawer); needs its own close/click-away logic. (c) **Expanded tooltip /
inline card** (pinned card positioned via `convertToPixel`). Simplifies:
smallest diff — `tooltipHTML` already produces ~80% of the content; no new
DOM section. Complicates: ECharts tooltips are ephemeral and `confine: true`
clips to the chart; weakest fit for B7's "click one highlighted point" flow.
*Content set.* **Existing fields only** (all in `combined.json`, zero
`update.py` change): name/id, rank, elo ± CI, votes, org, license, context
(OR), price in/out, vision, `arena_variants`, `match_method`/`match_ratio`,
override flag; plus client-only derivations: OpenRouter page link
`https://openrouter.ai/<or_id>` (verify it resolves for `:free`/slug-form
ids). **+ cheap data-layer additions** (each a one-line carry-through):
`modelUrl` from arena (154/154 rows — link to the model's own announcement);
arena-side $/M (145/154 rows — enables an arena-price-vs-OR-price
consistency read-out); arena vs OR context side-by-side (they disagree on
24/134 rows — useful signal); `releaseType` (only 3/154 non-null — low
value). OR-side `created`/`description`/`knowledge_cutoff`/`reasoning`/
cache+web_search+image pricing/`output_modalities` require a
`parse_openrouter` change plus carry-through — bigger diff, bigger file
growth (descriptions median ~211 chars × 154), and `pricing.overrides`
(length-tiered) adds real complexity for a corner case.

**Open questions.**
1. When B1 (or the vision filter) excludes the selected model, does the panel
   persist with a "filtered out" indicator, auto-close, or only allow
   selecting visible points?
2. Show arena vs OR context length side-by-side (24/134 differ), or one
   source?
3. Display arena-side $/M (145/154) as a price cross-check, or is OR pricing
   the single source of truth?
4. Confirm `https://openrouter.ai/<or_id>` is the right link format for all
   154 ids before wiring the client-only link.
5. Should clicking the frontier *line* (not just bubbles) also open the
   panel (needs stashing the renderPanel-local `frontier` array)?
6. Unrelated, found during exploration: `api.openrouter.ai` currently has no
   A/AAAA record (DoH → NXDOMAIN) while `openrouter.ai/api/v1/models` serves
   the same API (HTTP 200); update.py:24 uses the working apex URL — no fix
   needed, but worth a comment so nobody "fixes" it.

**Effort & deps.** Low for (b) or (c) with existing-fields-only content: pure
client — one `charts[id].on("click", ...)` registration in `renderPanel`
(app.js:310-318), a `state.selected` field, a `renderDetails()` function,
drawer CSS; no data regeneration, no `update.py` change. Medium for a rail
(a) or any content beyond existing fields: layout change plus one-line
`update.py` carry-throughs followed by a data commit; OR-side fields push
toward high-ish because they touch `parse_openrouter` and grow the JSON. B7
interaction: search highlight is a `state.search` feeding per-point
`itemStyle` overrides in the scatter build (app.js:225-246) under the existing
full-re-render model — compatible with (a) and (b) (click a highlighted point
→ same handler fills the panel); awkward with (c). B1 interaction: filtering
happens pre-`pointsFor`, so the only coupling is open question 1. No dep on
the B1/B7 implementations themselves.

### B4 — Logos instead of bubbles

**Plan:** `plans/007-logos.md` (draft, pending owner review).

Explore vendor/model logos on the chart instead of bubbles. The exploration
must answer the open question first: what are bubbles currently encoding —
size = votes, color = org — and what is lost if they are replaced (or kept
alongside logos). Also: logo source (OR model pages? per-org assets? where does
a static site fetch them from?).

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line:
logos are feasible today with zero ECharts work (`symbol: 'image://…'` is
natively supported, per-data, with `symbolSize` kept as votes), and the best
source is a committed ~23-logo set — OpenRouter's API has no logo field, its
pages host per-author icons at `openrouter.ai/images/icons/` but those are
keyed by OR author slug with provider fallbacks and mixed formats — and
replacing bubbles with logos would actually fix the org channel (8 of 23 orgs
currently share one fallback gray) while keeping the frontier line, override
rings, and vote-size mechanics intact.

**Feasibility.** ECharts 5.6 (pinned via CDN, index.html:313; canvas renderer,
app.js:313) natively supports image symbols: `symbol: 'image://<url-or-dataURI>'`
is documented for both series level and per-data-item, and `symbolSize`
accepts `number|[w,h]` at both levels (verified against the official
`option.series-scatter` docs). Today's vote-based sizing (`bubbleSize`,
app.js:120-124) survives verbatim, and non-square logos can be drawn
undistorted by passing per-item `[w,h]`. `itemStyle` still applies to image
symbols, so the gold override ring (app.js:238-239) and top-10 glow
(app.js:240-241) survive with no code changes; the 0.78 fill alpha
(app.js:237) becomes `itemStyle.opacity`. Images load asynchronously in
zrender with a redraw on load, so first paint may briefly show blank symbols
(documented mechanism; not pixel-verified in a browser). 154 image symbols is
trivial for canvas: per-org mapping means ~23 unique decoded bitmaps,
browser-cached per URL. The frontier line is a separate series built from the
same point centers, so it is unaffected by scatter symbol type. The real work
is sourcing/maintenance, not rendering.

**Evidence.** Verified encoding (app.js read in full, 451 lines):
- position: x = $/M on log axis (app.js:261-274), y = arena Elo
  (app.js:275-284); points built at app.js:83-95. All 154 models plot.
- size = arena votes: sqrt-scaled 5-30px diameter (app.js:120-124, applied at
  app.js:235). Measured on the 154 points (votes 2,420-129,278, median
  29,043): p25 = 9.2px, median = 14.8px (radius ~7.4px), p75 = 18.9px, max
  30px; 25 points < 8px, 38 points 8-14px, 91 points ≥ 14px.
- color = org: 15-color palette (app.js:5-9) + fallback `#64748b` (app.js:10);
  `buildOrgColors()` (app.js:32-44) assigns by model count, so 8 of today's 23
  orgs share the fallback gray — the color channel is already lossy.
- No symbol-shape variation; no dim state beyond the fill alpha.
- override = gold `#ffd166` 2px ring (app.js:230-239, 356-360,
  index.html:281); top-10 glow = `shadowBlur: 10` when `arena_rank <= 10`
  (app.js:240-241).
- frontier: separate line series, `#34d399`, 7px circle markers,
  `shadowBlur: 14` (app.js:201-223); 12 points today.
- spread bars: custom series, blue→amber gradient (app.js:161-199).
- tooltip: name, or_id, rank, elo ±CI, votes, in/out price, org, license,
  context, vision, match method (app.js:126-153). No point labels. No org
  legend exists — org color is only decodable via tooltip (index.html:279-283
  covers frontier/override/spread only).
- OR API: `GET https://openrouter.ai/api/v1/models` → 443 models; the full key
  union contains no image/logo/icon field at all (verified today; note
  `api.openrouter.ai` is currently NXDOMAIN, the apex host serves the API).
  The API is not a logo source.
- OR model pages: the logo renders as `<img alt="Favicon for
  <or-author-slug>" src="images/icons/<Name>.<ext>">`, hosted at
  `https://openrouter.ai/images/icons/` — a public hotlinkable path, small
  files. But it is keyed by OR author slug, and the file is often NOT the
  org's logo: measured provider-fallback cases — `minimax` → Modular.png,
  `stepfun`/`z-ai` → SiliconFlow.svg, `thinkingmachines`/`xiaomi` →
  DeepInfra.webp, `amazon` → Bedrock.svg; authors with no icon (`x-ai`,
  `upstage`, `arcee-ai`, `rekaai`) fall back to Google's favicon service.
- Sample OR icons (measured): Anthropic.svg 584B, 512², solid `#CC9B7A`
  background (not monochrome); OpenAI.svg 1.7KB monochrome path;
  GoogleGemini.svg 623B, 16², radial gradient; Mistral.png 869B at 191×135
  (non-square — distorts under a square `symbolSize` unless per-item `[w,h]`);
  DeepSeek.png 24KB 200²; MoonshotAI.png 235KB; Modular.png 17KB.
- Per-org asset availability (all verified by HTTP): simple-icons CDN
  (monochrome 24×24 SVGs, ~2KB, recolorable) returns 200 for anthropic,
  google, meta, mistralai, deepseek, moonshotai, minimax, xiaomi, qwen and 404
  for openai, alibaba, xai, cohere, ibm, microsoft, tencent, upstage, stepfun,
  zai. worldvectorlogo returns 200 for openai, alibaba, ibm, tencent, gemini,
  microsoft, amazon, xai and 404 for cohere, zhipu, upstage. Official og:image
  present for anthropic.com, deepseek.com, mistral.ai, minimaxi.com, qwen.ai
  (80×80); absent from homepage HTML for openai.com, meta.com, x.ai,
  moonshotai.com, z.ai (JS-rendered). Every top-11 org is reachable via 1-2
  sources; Z.ai is the weakest. NOT verified: long-tail orgs (StepFun, Thinky,
  Upstage, arcee-ai, rekaai), hotlinking policies of simple-icons/worldvectorlogo,
  pixel legibility at 5-10px, zrender's post-load redraw (docs only).

**Options.** (a) **Replace bubbles with logos** (per-org logo as point symbol,
`symbol: 'image://…'` per data item, `symbolSize` = existing `bubbleSize()`):
- simplifies: fewer channels to explain; the legend shrinks; org identity
  becomes immediate, fixing the 8-of-23-gray problem (app.js:41) and
  reinforcing model identity into B3.
- complicates: sourcing + maintenance for 23 growing orgs (reuse `orgOf()`,
  app.js:26-30, as the key); aspect handling via per-item `[w,h]` or
  pre-cropping; format normalization (svg/png/webp); fallback glyph for
  unknown orgs; hotlink-vs-commit decision; blank-until-load flash.
- lost: color=org is subsumed (the logo IS the org marker); multicolor assets
  (Anthropic's terracotta, Gemini's gradient) break the uniform dark palette,
  and per-org tinting only works for monochrome SVGs, not PNGs. Size=votes is
  mechanically retained but perceptually diluted — viewers read logos as
  identity, not size; the 25 sub-8px points become smudges (raise a floor or
  drop votes entirely for small points).
(b) **Keep bubbles + logo in tooltip only** (inline `<img>` in `tooltipHTML`,
app.js:126-153): simplifies: zero channel loss, ~1h change; complicates: still
requires the org→logo map + fallback sourcing decision; lost: nothing on the
chart, but the logo only pays off on hover.
(c) **Keep bubbles + per-org logo legend strip** (org→logo row beside the
existing legend row, index.html:279): simplifies: all channels preserved AND
org color becomes decodable at a glance for the first time (no org swatch
legend exists today); name+logo disambiguates the 8 gray orgs; ~23 × (16px
logo + label); complicates: second-step lookup for non-frontier points;
crowds a footer that already carries three items; same sourcing pipeline
required; lost: nothing except horizontal space.
(d) **Mechanics notes** (shared by all options): per-data `symbol` is the
idiomatic path — no custom series or `graphic` component needed. The frontier
line stays meaningful (separate series, same centers); its 7px circle markers
can stay circles (at 7px a logo is a smudge). Performance is a non-issue: 154
image symbols through the 450ms entrance animation is ~23 small `drawImage`
calls per frame. Cross-origin images taint the canvas only if pixels are read
back, and the site exports no images. Committing SVGs under
`public/assets/logos/` (referenced relatively or inlined as dataURI) removes
runtime network dependency entirely.

**Open questions.**
1. Commit the logo set under `public/assets/` (self-contained; `update.py`
   HEAD-checks each URL on data refresh, matching the fail-fast convention)
   or hotlink (zero repo weight, third-party breakage risk)?
2. Per-org logos, or per-model where OR shows distinct identity (Qwen vs
   Alibaba, GoogleGemini vs Google)?
3. Keep size=votes, or let logos carry identity and go flat ~14px?
4. Monochrome/recolor all marks (uniform dark-theme look, SVG-only) or brand
   color (PNGs break uniformity)?
5. What is the fallback glyph for an org without a logo (initial-in-circle,
   gray dot)?
6. Do frontier markers stay green circles or become tiny logos?

**Effort & deps.** Sourcing (picking + verifying ~23-26 logos,
aspect/format normalization) dominates every option: ~1-2h, independent of
rendering. (b): low, half a day including the tooltip change. (c): low-medium,
~1 day (legend strip + sourcing). (a): medium, 1-2 days (per-data symbols,
`[w,h]` handling, fallback, legend rework, browser check). All three share the
same org→logo map, which is also the asset B3's detail-panel header would use
— no conflict, and doing sourcing first lets B3 inherit it for free.
`update.py` is the natural validation point (HEAD-check logo URLs on refresh;
a new org without a logo must fall back, not break the chart).

### B5 — Other cross-referenceable data

**Plan:** `plans/008-data-enrichment.md` (draft, pending owner review).

Open survey: what else can be joined onto arena × OpenRouter (pricing over
time? context-window claims vs reality? context length we already keep?
modality coverage we partly have?). Same constraints: name-based join,
committed JSON, fail-fast validation.

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line: the
OpenRouter API now silently carries ~11 fields update.py drops — including
syndicated LMArena-design + Artificial-Analysis benchmarks (119/154 joined
models), created/EOL dates, and full modality input — so most of B5 is
zero-new-fetch enrichment; the only genuinely new source worth adding is
Wayback Machine pricing history (187 snapshots since 2023, measured 33–53% of
comparable prices moving per quarter).

**Feasibility.** Cheap client-side (already fetched, currently dropped in
`parse_openrouter`, update.py:122): richer modalities
(`architecture.input_modalities`/`output_modalities`), `created`,
`expiration_date`, `knowledge_cutoff`, `reasoning.mandatory`,
`supported_parameters` (tools/response_format), `pricing.input_cache_read`,
`top_provider.context_length`, `canonical_slug`, and the whole `benchmarks`
object. Arena-side `inputPricePerMillion`/`outputPricePerMillion` are already
committed in arena.json (304/402 entries) — a price cross-check is pure
join-side math, zero fetches. Needs an update.py fetch: Wayback snapshots
(CDX query + N snapshot downloads of 0.3–0.7 MB each; curate ~12), tokencanopy
CSVs (two small files from raw.githubusercontent.com), HF API param counts
(~76 requests, a third source needing rate-limit + lenient validation). Note:
`api.openrouter.ai` is NXDOMAIN today (A/AAAA/CNAME all status 3 via DoH); the
repo's `openrouter.ai/api/v1/models` (update.py:24) is the live one — no change
needed, but worth a comment. Browser-side CORS for Wayback/tokencanopy is
unverified ("check before committing").

**Evidence.** Raw OR entry (443 raw → 351 after dropping `~` aliases and
`:batch`, matching committed counts exactly). All 443 carry: `id`,
`canonical_slug`, `hugging_face_id`, `name`, `created` (epoch),
`description`, `context_length`, `architecture{modality, input_modalities,
output_modalities, tokenizer, instruct_type}`, `pricing{prompt, completion,
input_cache_read}`, `top_provider{context_length, max_completion_tokens,
is_moderated}`, `per_request_limits`, `supported_parameters`,
`default_parameters`, `supported_voices`, `knowledge_cutoff`,
`expiration_date`, `links.details` (a live per-model endpoint:
`/api/v1/models/{id}/endpoints`). Partial: `reasoning` (311/443),
`benchmarks` (248/443), `alias_target` (18). update.py drops all of:
canonical_slug, hugging_face_id, created, description, input_cache_read,
top_provider, per_request_limits, supported_parameters, default_parameters,
supported_voices, knowledge_cutoff, expiration_date, links, reasoning,
benchmarks. Top level is `data`/`total_count`/`links` — no `updated` field, no
pagination, no history endpoint.
- Pricing over time, measured from Wayback: 187 snapshots of the models
  endpoint, 2023-07-26 → 2026-09-15, all HTTP 200 JSON; the 2026-09-15 capture
  holds full pricing for all 446 models. OR catalog grew 296 → 446 across the
  sampled span. On the 154 joined models, per quarter: 2025-04→08: 17/32
  comparable input prices changed (11 >25%); 08→12: 30/59 (23 >25%);
  2025-12→2026-04: 29/76 (19 >25%); 2026-04→09: 39/117 (22 >25%). Only 32/154
  existed as far back as 2025-04 (joined set skews recent), 117/154 by
  2026-09. Community archives: `github.com/tokencanopy/price` verified
  (11,185-row `data/current/prices.csv` incl. 2,762 openrouter rows; 59,083-row
  `data/history/price_changes.csv`; 6-hourly git CI; join key `model_key` = OR
  id) but history starts 2026-09-02 and the repo has 1 star.
  `yyh-001/llm-value-rankings` (21★, daily) has `data/rank_history.json` =
  daily value-rank history keyed by OR id (B2-adjacent).
- Modalities, measured on 351 kept / 154 joined: image-in 192/93, video-in
  59/31, audio-in 30/16, file-in 100/60, image-out 11/1, audio-out 4/0. The
  current `vision` bool captures image-input only. `modality` string has 16
  values (text->text 148, text+image+file->text 66, …); `tokenizer` 16 values
  (Other 123, GPT 59, Qwen3 36, …); `instruct_type` null on 312/351;
  `supported_voices` non-null on 0/351. The one joined image-output model is
  `google/gemini-3-pro-image`, collapsed into the "gemini-3-pro" row — its
  image-output capability is invisible in combined.json today.
- Context, measured on 154 joined: 134 have both values, 110 agree exactly, 24
  disagree (OR>arena in 20, arena>OR in 4): `llama-4-scout` OR 1.31M vs arena
  8k (arena looks like a data quirk), `grok-4.20-multi-agent-beta-0309` 2M vs
  1M, `llama-4-maverick-17b-128e` 1M vs 128k, `claude-sonnet-4-5-20250929-high-32k`
  1M vs 200k; arena>OR cases: `gemini-3-pro` OR 128k vs arena 1M,
  `kimi-k2-0905-preview` 128k vs 256k. `top_provider.context_length` is lower
  than model-level `context_length` in exactly 24/154 (never higher) → the OR
  value we keep is the best across providers; arena lists vendor-claimed
  values. Empirical/validated context behavior: no machine-readable source
  found — "claims vs reality" has no data source; "claim vs serving" (OR
  top-provider) we already have in two columns.
- Misc, measured: `created` on all 443; joined-154 distribution 2023: 2, 2024:
  17, 2025: 63, 2026: 72 (this is "listed on OR", not official release date).
  `expiration_date` non-null on only 4/351 catalog-wide; arena `releaseType`
  null on 399/402. `knowledge_cutoff` on 23/154. `benchmarks` =
  `design_arena` (LMArena web-design board, up to 18 categories, each with
  elo/win_rate/rank) on 119/154 + `artificial_analysis{intelligence_index,
  coding_index, agentic_index}` on 91/154 — and the field is new: 0/370 in the
  2026-04-30 Wayback snapshot, 251/446 by 2026-09-15. `hugging_face_id` on
  76/154 (open-weight only); HF API verified:
  `huggingface.co/api/models/{id}` → `safetensors.total`. Arena license is
  already a rich string (40 distinct values, 402/402 present). Arena-side
  price cross-check: 132/154 comparable, 105 exact agree, 27 diverge
  (gemini-3.5-flash $1.50 vs $0.75/M, claude-sonnet-4.6 $3.00 vs $1.50,
  gpt-5.1 $1.25 vs $0.625 — vendor list vs OR provider price). `tools`
  supported on 142/154, `response_format` 138/154, `reasoning.mandatory` true
  on 38/154, `input_cache_read` priced on 110/154. `canonical_slug` ≠ `id` for
  291/443; as a join key it would make 12 current non-exact matches exact but
  break 7 exacts (net +5). Could NOT verify: Wayback/tokencanopy CORS from
  browser, tokencanopy durability, AA's raw data files, official RULER
  results.

**Options.** Ranked by value/effort (ledger per option, no pre-baked answer):
1. **Modality enrichment** — replace `vision` with `input_image/input_video/
   input_audio/input_file/image_output`. Adds: a real modality filter (video-in
   31/154, file-in 60/154 are invisible today) + B3 detail content. Costs: ~5
   fields × 351 models (~+10 KB), app.js filter change; decide `vision`
   rename vs keep-for-compat.
2. **Price cross-check (arena vs OR)** — adds: a 27-model "sources disagree"
   badge (some 2×) and an implicit trust signal on the 105 agree; data already
   committed, so only join-side code. Costs: one derived field per model; must
   document that divergence is expected (vendor list vs provider price), not
   an anomaly — don't fail-fast on it.
3. **OR-syndicated benchmarks** — adds: two benchmark axes (design-arena
   category elos, AA indices) with zero new fetch; feeds B2's filter and B3's
   panel. Costs: nullable `benchmarks` passthrough (field is <5 months old —
   treat absence as normal, ~35/154 missing), ~+15–25 KB, and a big ownership
   question with B2/B6.
4. **Status/time fields** — `created`, `expiration_date`, `knowledge_cutoff`,
   `reasoning.mandatory`, `tools`, `input_cache_read`. Adds: age, EOL, cutoff,
   agent-capability display (B3). Costs: 6 fields, trivial size; EOL is thin
   (4/351) so it's a bonus column, not a dimension.
5. **Price history via Wayback** — adds: "price moved ±X% since last fetch"
   flag (cheap) or per-model sparkline arrays (richer). Costs: CDX + ~12
   curated snapshot fetches in update.py (transient few MB), a new
   `price_history.json` or per-model array, validation for sparse old coverage
   (32/154 in 2025-04), and a decision: snapshot fetch failure = hard fail or
   warn-and-skip (recommend warn, since it's secondary data).
6. **Price history via tokencanopy CSV** — adds: 6-hourly change log +
   2-week history + cross-platform price comparison for free. Costs: 2 small
   CSV fetches; durability risk (1★, young repo) — good for a "recently
   re-priced" flag, risky as the system of record.
7. **Param counts via HF** — adds: a model-size axis for chart encoding or B3.
   Costs: ~76 third-source fetches, rate-limiting, lenient validation; ~76/154
   coverage ceiling.
8. **Context-disagreement flag** — "OR serves less/more than arena claims"
   marker on 24 models; client-side-only from existing columns. Low drama.
9. **`canonical_slug` join tier** — net +5 exact joins, cleaner identity for
   dated OR ids. Costs: new match method between exact and prefix-base; 7
   current exacts flip — validation must measure before/after, and meta.json
   should report the new tier.

**Open questions.**
1. Does B5 own the benchmarks pipeline plumbing, or hand `benchmarks`
   wholesale to B2?
2. Price-history shape: change-flag only vs full point arrays (committed-JSON
   size budget)?
3. Wayback (long, sparse) vs tokencanopy (dense, 2 weeks) vs both?
4. Is OR `created` (list date) an acceptable "release date", or do we want
   official dates (no verified source found)?
5. Context: keep both columns + flag (status quo + flag) or normalize to one?
6. Rename `vision` → `input_image` (touches app.js) or keep the name?
7. Display EOL given only 4/351 have it?

**Effort & deps.** Modality enrichment: low; feeds B3. Price cross-check:
low; feeds B3. OR benchmarks: low pipeline effort, **heavy overlap with B2**
(cheapest benchmark source in existence; if B2 proceeds, B5 should cede
display and keep plumbing) and **partial overlap with B6** (OR's
`design_arena` IS the lmarena web-design board, syndicated; B6's direct
scrape of other boards stays complementary). Status/time fields: low; mostly
B3 content. Wayback history: med. tokencanopy: low. HF param counts: med
(third source); feeds B3/B1. Context flag: low. canonical_slug tier:
low–med; independent, but run it before B6 so multi-board joins inherit the
better key. B3 is the recurring dependency: every field added here is
candidate detail-panel content, so sequencing B5 before B3 is cheap insurance.

### B6 — Other lmarena leaderboards

**Plan:** `plans/009-multi-board-arena.md` (draft, pending owner review).

The data layer only scrapes `lmarena.ai/leaderboard/text` (RSC payload).
Exploration should inventory the other leaderboards (vision, webdev, …),
verify their payload shape is the same `self.__next_f` surface, and define how
multi-leaderboard data coexists in the join (arena Elo becomes per-board;
frontier semantics must be decided).

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line: all
11 standard arena boards share the exact `self.__next_f`/`"entries":` surface
that `parse_arena` already parses — extension is a loop over a board dict, not
a new scraper — with the real design work in per-board join keys (modelKey is
*not* cross-board stable), per-board validation thresholds, and the
frontier/elo-map semantics; 108 of our 154 models already carry 2nd–6th Elo
scores from other boards. Note: `lmarena.ai` now 301-redirects to `arena.ai`
(both serve identical pages).

**Feasibility.** Substantial extension of the *data* layer, trivial extension
of the *parse* layer — and the parse is the part that was verified.
`parse_arena` (update.py:106) is three steps: `RSC_RE` finds
`self.__next_f.push([1,"…"])` chunks, `_decode_chunk` JSON-unescapes them,
`_extract_json_array` scans the first `"entries":` anchor with a bracket
counter. That exact pipeline (imported from update.py) run against all 12 live
board pages: every one of the 11 standard boards yields its full `entries`
array unchanged, same 18-field schema. What changes: (1) `ARENA_URL` becomes a
board→URL dict and `main()` loops; (2) `validate` (update.py:337) currently
hard-codes `TOP20_MATCH_MIN=18` / `OVERALL_MATCH_MIN=0.40` /
`ARENA_COUNT_MIN=50` for one board — small boards (search=34, vedit=10 models)
cannot meet "top-20 matched" without a per-board threshold policy; (3) the
join is per-board, and the cross-board identity key is NOT `modelKey` — it's
`(modelOrganization, modelDisplayName)`, which the join currently normalizes
only on the display name alone; (4) `combined.json` rows gain a per-board
dimension (`arena_elo` scalar → map). The agent board is the one outlier:
different schema entirely (`model`/`score`/`contenderName`, `score` ∈
[−0.3, 0.33], not Elo) — needs its own parser and should be excluded from v1.

**Evidence.** All fetched 2026-09-16 from live arena.ai. Board inventory
(counts = parsed `entries` arrays, cross-checked against hub metadata
`totalModels`):

| Board | URL | models | totalVotes | vote cutoff | schema |
|---|---|---|---|---|---|
| Text (current) | /leaderboard/text | 402 | 8.1M | 2026-09-13 | standard 18 fields |
| Vision | /leaderboard/vision | 152 | 1.3M | 2026-09-13 | standard |
| WebDev | /leaderboard/code/webdev | 128 | 0.68M | 2026-09-11 | standard; 11 subcategory slugs |
| Image-to-WebDev | /leaderboard/code/image-to-webdev | 50 | 0.13M | 2026-09-13 | standard |
| Text-to-Image | /leaderboard/text-to-image | 78 | 6.1M | 2026-09-07 | standard, `pricePerImage` live (47/78) |
| Image-Edit | /leaderboard/image-edit | 55 | 29.5M | 2026-09-07 | standard, `pricePerImage` (32/55) |
| Text-to-Video | /leaderboard/text-to-video | 48 | 0.67M | 2026-09-04 | standard, `pricePerSecond` (32/48) |
| Image-to-Video | /leaderboard/image-to-video | 48 | 2.0M | 2026-09-14 | standard, `pricePerSecond` (35/48) |
| Video-Edit | /leaderboard/video-edit | 10 | 28K | 2026-08-26 | standard, `pricePerSecond` (4/10) |
| Document | /leaderboard/document | 44 | 0.40M | 2026-09-13 | standard + `rankStyleControl` |
| Search | /leaderboard/search | 34 | 1.1M | 2026-08-24 (stalest) | standard + `rankStyleControl` |
| Agent | /leaderboard/agent | 43 distinct | — | — | **different**: `model, score, ciLower/ciUpper, contenderName, license, modelOrganization, isPublic`; 5 signal sub-boards ×46 rows + cost stats |

- Payload verification (the crux): identical RSC surface on all 11 standard
  boards — same chunk regex, same `"entries":` anchor (exactly one per board
  page; ~20 extra `rating` fields per page belong to a separate widget). Field
  sets are the same 18 keys as text; document/search add `rankStyleControl`
  which current code ignores harmlessly. `votes` are per-board
  (claude-fable-5: 30,057 text vs 11,304 vision). Arena $/M prices are
  per-model, not per-board (claude-fable-5 = 10/50 on both text and vision).
  `pricePerImage`/`pricePerSecond` are the live price fields on media boards
  (chat boards: 0 non-null). Elo scales differ per board (text #1 ≈1505.7,
  vision #1 ≈1309.5, webdev #1 ≈1800.3, search #1 ≈1257.3) — not directly
  comparable on one axis. The hub page (/leaderboard, "Overall" tab)
  SSR-embeds **all 10 non-text boards in full plus text truncated to top-200**
  (verified: first 200 identical to arena.json, 847 rating fields = exact sum
  of the 11 arrays), each with `totalModels`/`totalVotes`/
  `voteCutoffISOString` metadata — a 2-fetch layer (hub + text page) would
  cover all 11 boards.
- Overlap (measured against live payloads, keyed on normalized
  `(modelOrganization, modelDisplayName)`): vision 115/152 and webdev 94/128,
  img2webdev 40/50, document 39/44, search 9/34 appear on the text board; all
  five media boards: 0/78, 0/55, 0/48, 0/48, 0/10 (disjoint media models). Of
  our **154 combined models: 76 gain a 2nd Elo on vision, 77 on webdev, 37
  img2webdev, 33 document, 8 search; union = 108/154 (70%) have ≥1 other-board
  Elo, 26 have all five** (claude-fable-5, claude-opus-4.7, gpt-5.6-sol,
  grok-4.5 are on all 5). modelKey is *not* a cross-board key: older models
  share keys across boards (92/152 vision keys match text verbatim) but new
  models get board suffixes (`claude-fable-5-text` vs `-vision`) or internal
  codenames (`thunbergia-alpha-9e3w` = qwen3.8-max on vision;
  `lina-f-alpha-wyi7` = gpt-image-2.5-sunburst on t2i). OR join potential for
  media boards is thin on exact slugs (t2i 3/78; video boards 0/48), though
  prefix rules could catch e.g. `gemini-omni-1.1-flash` →
  `google/gemini-omni-flash`. Search board runs dedicated builds (`-search`
  modelKeys, 24/34). Not verified: subcategory boards (text embeds 31 category
  slugs — but only `overall` data is in the SSR payload; `?category=coding`
  returns the identical 402, i.e. categories are client-side lazy loads);
  regional boards (no nav entry — the old lmarena regional boards appear
  gone); whether `voteCutoffISOString` is a rolling window; whether the agent
  board has any aggregate score beyond the 5 signals. UI grounding: app.js:428-429
  fetches only `combined.json` + `meta.json`; y = `arena_elo` scalar, size =
  `arena_votes` (app.js:120,156), color = `arena_org`, frontier =
  pareto(price, elo) (app.js:97-98).

**Options.** (a) *Data layer.* **A1:** `BOARDS = {slug: url}` dict in
update.py, one fetch per board, `parse_arena` reused verbatim, per-board
`validate` with policy: hard thresholds on text (the anchor), per-board
relaxed rules elsewhere (e.g. top-10-matched ≥8 for 34-model boards,
min-count floors). Simplifies: minimal diff, per-board failure isolation in
the match report. Complicates: 12 fetches/latency, threshold policy to invent
and maintain. **A2:** hub fetch + text fetch (2 requests for 11 boards;
per-board staleness visible in meta). Simplifies: fewer requests. Complicates:
text still needs its own page (hub truncates to 200), one fat ~5.4MB request,
coupling to hub SSR layout. **A3 (file layout):** one `arena.json` with board
dimension `{text: [...], vision: [...]}` vs one committed file per board vs
entries tagged with a `board` field. Simplifies (per-file): raw diffs
reviewable per board, zero schema coupling. Complicates (per-file): N files +
N meta sections; the single-file variants keep the 4-file contract. (b)
*Join.* **B1:** per-board join; combined keeps `arena_elo`/`arena_rank`/
`arena_votes` as **text defaults** (back-compat, app.js untouched) plus
`arena_elo_by_board: {board: {elo, upper, lower, rank, votes}}`. Simplifies:
one scalar for the frontier, old tooltips still work. Complicates: text values
duplicated in two places. **B2:** pure map, no scalar. Simplifies: single
source of truth. Complicates: every app.js read site changes. **B3:** join
media boards at all — with codename modelKeys and labeled display names
("gpt-image-2 (medium)"), joins are name-fuzzy + overrides; expect most media
models unmatched (fine if boards are soft-validated) or a growing
overrides.json. (c) *UI.* **C1:** board selector in the filter bar (default
Text); y = selected board's Elo, size = that board's votes, frontier
recomputed per board. Simplifies: familiar single-chart semantics, composes
with the B1 org filter. Complicates: naming collision with the existing
"vision" *capability* filter (rename one), per-board frontier semantics to
document. **C2:** overlay all boards (up to 6 points/model, ~700 pts for 108
multi-board models). Simplifies: cross-board comparison in one view.
Complicates: different Elo scales per board on one y-axis (normalize or
offset), density, filter/tooltip interaction. **C3:** treat boards as B2's
benchmark source — board Elo = benchmark score, board filter = benchmark
filter, UI shape decided in B2. (d) *What breaks/stays:* org color stays;
votes become per-board but size is min-max normalized per render so no visual
break; OR prices (x-axis) unaffected; arena's own $/M and
`pricePerImage`/`pricePerSecond` are currently *not* in combined.json at all
(arena.json only) — per-board price fields are a net-new opportunity for media
boards; overrides.json is name-keyed so it works per-board for free; meta.json
needs per-board join stats; the 41 `variants_collapsed` groups would
generalize to across-board variant collapsing (a model on text+vision+webdev
collapses to one OR row).

**Open questions.**
1. Frontier semantics: frontier of the *selected* board (recommended default)
   vs overlay all boards' frontiers vs "frontier on ≥1 board" — the one
   decision the owner must make.
2. Board set for v1: the 5 chat-like boards (text/vision/webdev/document/
   search — 108/154 covered) vs +5 media boards (0/154 OR-joined today) vs
   agent (separate schema).
3. Which models appear on a non-text board's chart — only OR-matched ones
   (consistent with today) or all board entries?
4. Naming: the vision board vs the existing "vision" capability filter need
   distinct labels.
5. Validation policy: which boards are hard-fail vs soft-report, and what
   thresholds for 10–50-model boards that may OR-match poorly?
6. Are subcategory boards (text's 31, webdev's 11) in scope at all — they're
   not in the SSR payload (client-side lazy load), so scraping them means
   solving a second transport.
7. Agent board: B6 scope (needs its own parser, `score` ≠ Elo) or B2 (it's
   benchmark-shaped: per-signal scores)?
8. Staleness: search board cutoff is 3 weeks behind the others — per-board
   `fetched_at`/cutoff in meta, or a freshness gate?

**Effort & deps.** Data layer for the 5 chat-like boards: **med** — ~100–150
lines in update.py (BOARDS dict, looped fetch/parse, per-board validate,
per-board join into the elo-map, meta.json section); media boards add little
parse effort but real join/override maintenance: **low per board**; agent
board: **med** (new parser) — defer. UI board selector: **low-med** (~80–120
lines app.js + index.html, reusing the existing state/re-render and the
dim-patterns from the vision filter). Total v1 (5 boards + selector): **med**.
No infra change (still static assets, wrangler deploy). Deps: **B1** — both
are filter-bar controls; decide the selector pattern and the hide-vs-dim
semantics together (board as hard filter would recompute the frontier over the
per-board set, mirroring B1's open question). **B2** — lmarena boards are
exactly one benchmark source: B6 owns the lmarena scrape/join/per-board-Elo
data pipeline; B2 owns cross-source benchmark filtering and external benchmark
sets, and the `arena_elo_by_board` map is the shape B2's filter would consume
— if B2 lands first, design combined.json's benchmark dimension generically.
**B3** (details panel) gets per-board Elo/votes for free from the map.
Scratch artifacts for this exploration are in `.tmp/b6/` (fetched HTML +
per-board entry JSON + a parse report), gitignored.

### B7 — Search input box

**Plan:** `plans/010-search-highlight.md` (draft, pending owner review).

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

**Findings (2026-09-16, explore sub-agent, research only).** Bottom line:
low-effort and pattern-complete in-repo; the data settles the highlight-vs-hide
question — hide semantics collapses family-level searches to 1-2-point
"frontiers" and rescales the axes, so soft dim is the sound default (total
change ~55-70 lines).

**Feasibility.** The preliminary 60-80 line estimate holds, at the low end.
Tally: JS ~35-45 lines — `search` field in `state` (app.js:14-20, 1 line);
`searchHit(d)` surface-builder + matcher (~10); dim branch in the models'
per-point `itemStyle` (app.js:236-242, ~8); match-count span update (~3);
`input` listener in `bindFilters` (app.js:381-423, ~6); optional spread-bar
dimming (~8); optional 0-match state (~5). HTML/CSS ~18-22 lines — input +
count span inside `nav.filters` (index.html:249-267) and a dark-theme rule
block beside `.ratio` (index.html:118-143 is the existing input-container
precedent). No data-layer or `update.py` changes; fully client-side,
consistent with every existing filter.

**Evidence.** Verified against app.js / index.html (line numbers exact):
- State + re-render path: `state` at 14-20 (mode/vision/frontier/spread/ratio);
  `render()` 328-345 → `renderPanel()` 289-326 → `chartOption()` 155-287 →
  `setOption(opt, true)` at 315-318 (notMerge). Every filter change is a full
  re-render; there is no incremental path.
- Slider precedent confirmed: `slider.addEventListener("input", …)` at 406-411
  — the text box is the same pattern with `state.search`.
- Per-point styling: models scatter series 225-246; per-point `itemStyle` at
  236-242 with fill `withAlpha(color, 0.78)` (237; `withAlpha` helper 46-51).
  A dim branch slots in here with no structural change.
- **There is NO existing dimmed state.** Vision is a hard HIDE: `filtered()`
  at 68-71 drops non-vision rows entirely, and the frontier recomputes over
  the hidden set (298-300). Soft highlight would be the app's first dimmed
  visual — deliberate contrast with B1's hide lean, and the right place for it
  since search is keyword-level, not categorical.
- Tooltip 252-260 (formatter 259 keeps per-point `d`); frontier line 201-223
  with one `itemStyle` for all markers (208); spread bars 161-199 with fixed
  0.55-alpha gradients (176-181). No chart click handler exists (listeners
  only at 383/392/401/407/413/418) — B3 starts from zero, so dimming cannot
  collide with an existing click path.
- Data: 154 models, all plotable (zero null prices, all have elo), 0 use the
  org fallback, 31 `arena_variants` strings that are not already substrings of
  the base surfaces (dated snapshots, `-max`/`-instant`/`-high` suffixes).
- Match counts, case-insensitive over or_name‖or_id‖arena_org‖arena_model‖
  variants; frontier = the app's own dominance rule (app.js:99-118), blended
  price at default 3:1:

  | query | matches | frontier if hidden |
  |---|---|---|
  | (global) | 154 | 10 |
  | opus | 7 | **1** |
  | grok | 5 | **1** |
  | sonnet | 4 | 2 |
  | gpt-5 | 13 | 4 |
  | gemini | 12 | 5 |
  | anthropic | 15 | 6 |
  | qwen | 26 | 8 |
  | "1" | 49 | 6 |
  | "3" | 74 | 9 |

  Degeneracy detail: "opus" → all 7 are the Claude Opus line, five of them at
  the *same* blended price ($10/M) with elo 1472-1505, so only Claude Opus 4.6
  survives dominance. Same at ratios 1/3/10 (opus/grok → 1 each, stable).
  Family-level searches degenerate to a point or 2-point segment; org-level
  searches (5-8 points) stay meaningful under hide. Additional hide
  consequence: neither axis sets min/max (xAxis 261-274 log, yAxis 275-284
  value), so hiding re-fits the log axis per query — "opus" would zoom to
  ~$10-30 × elo 1426-1505, losing the user's positional context. (Expected
  ECharts auto-fit behavior; not browser-measured here.)
- Could NOT verify: the visual feel of each alpha level (that's the A/B),
  render timing (inferred from the slider precedent — full `setOption` per
  keystroke already happens at 407-411 — not benchmarked), and B1/B3
  implementation specifics (composition analyzed against their documented
  leans).

**Options.** *Match semantics* — cost negligible for all (154 × ~6 short
strings per keystroke, same order as the slider's existing full re-render):
- (a) Plain case-insensitive substring: handles "opus"/"gpt-5"/"anthropic"/
  "4.5"; fails cross-surface reordering — measured "claude anthropic" → 0
  hits, "gpt 5" (spaced) → 0 hits. Simplest, most predictable.
- (b) Multi-token AND: fixes reordering ("claude anthropic" → 15); adds a
  looseness worth knowing: "gpt 5" → 19 *including GPT-4 and GPT-4.1* (a dated
  variant `gpt-4.5-preview-2025-02-27` supplies the "5"), "haiku 4" → 2. +2
  lines vs (a).
- (c) Token OR: too loose for highlight intent — measured "gpt 5" → 80,
  "gemini 3" → 77, "haiku 4" → 55.
- (d) Include `arena_variants`: +0 lines (already in the concatenated
  surface); the 31 non-redundant strings make "opus max" hit Claude Opus 5 via
  variant `claude-opus-5-max` — probably desirable.
*Highlight vs hide:*
- Hide: reuses the vision/B1 mechanic (filter in `filtered()` 68-71); frontier
  recomputes over matches — meaningful at org level, degenerate at family
  level (1-2 points); axis re-fits per query; the "n models" count (324-325)
  changes meaning.
- Highlight (dim non-matches, ~0.12-0.4 alpha): frontier stays the global
  10-point curve, positions/sizes/colors/axis all preserved; open sub-decision
  — the green frontier line then threads through dimmed markers, so decide
  whether to dim the *non-matching frontier markers* too (per-point
  `itemStyle` on the frontier series data, ~6 lines) or keep them bright.
*No-match feedback* — precedent: the `.count` span in each panel head
(index.html:276/289/301; CSS 196-201; JS 324-325 renders "154 models · N
skipped (no price)") — a count exists but none in the filter bar itself:
- (a) "n/154" next to the box: +4 lines; the count is price-mode- and
  ratio-independent, so no per-panel bookkeeping.
- (b) Explicit 0 state (all-dimmed chart + "no match" hint, amber border à la
  the override-gold precedent): +~5 lines; guards against "is it broken?".
- (c) Nothing: 0 lines; the chart state carries it.
*Styling for the manual A/B* — all are one-line changes at 236-242 (base fill
0.78):
- Dim strength: `color: withAlpha(color, hit ? 0.78 : 0.12 | 0.25 | 0.4)` with
  `borderColor` dimmed in proportion (line 238). 0.12 = ghost, 0.25 = clearly
  off, 0.4 = soft.
- Emphasis ring on matches: `borderColor: "#f8fafc", borderWidth: 2` — the
  override-gold ring (238-239) is the in-repo ring precedent; white avoids the
  frontier-green / override-gold collisions.
- Size bump: `symbolSize: bubbleSize(...) * (hit ? 1.15 : 1)` at line 235 —
  distorts the votes encoding; ring over bump if only one.
- Single highlight color: matches → `#f1f5f9` flat, non-matches keep dimmed
  org color — org identity then lives only in the tooltip.
- Spread bars: dimming per model requires `renderItem` to carry `d` (data
  array 303-307 is currently `[pin, pout, elo]`), ~8 lines; alternative is
  leaving them at their fixed 0.55 alpha.
*Composition with B1/B3:*
- One state object: `search` beside B1's org/family and the existing five
  fields. Pipeline: DATA → B1/vision hard-hide (`filtered()` 68-71) → frontier
  over the visible set (300) → search dim overlay (236-242). Search dims
  *within* the visible set; its count reflects the visible set, so "Pareto of
  OpenAI gpt-5.x" + search "nano" composes as intended.
- Search text survives mode and B1 changes for free (state field, re-render
  reapplies); no clearing logic needed on filter change.
- Keyboard: Escape-to-clear ~2 lines; Enter is a no-op (live `input`
  filtering); optional `×` clear button, optional `/` focus.
- B3: no click handler today, so dimmed points are clickable anyway — decide
  open-panel-anyway (simplest) vs ignore-dimmed.
- Corner: B1 selection empty → zero points, search is a visual no-op; "0
  search matches" (everything dimmed) is visually distinct from "B1 empty"
  (nothing drawn) — keep both states distinguishable.

**Open questions.**
1. Dim alpha: 0.12 / 0.25 / 0.4?
2. Match styling: keep org color vs single highlight color; ring and/or size
   bump?
3. Dim non-matching *frontier markers* (green dots) too, or keep them bright?
4. Match semantics: substring (a) vs multi-token AND (b); include
   `arena_variants` (d)?
5. No-match feedback: "n/154" count, explicit 0 state, or neither?
6. Dim spread bars or leave them at 0.55?
7. B3: click on a dimmed point — open the panel or ignore?
8. Keyboard: include Escape-clear and/or `/` focus?

**Effort & deps.** Low (~half a day including the A/B feel-out). No hard
dependencies; natural order is B1 first — search then lands as a style branch
on B1's `filtered()` path sharing the same state object — and B3's Q7 should
be decided at B3's review. No data-layer or `update.py` changes; no new deps.

## Graduated plans (step 2, 2026-09-16)

Per the process, each item graduated to its own plan doc — one plan per
examination, to be implemented or examined with the owner in separate future
sessions:

| item | plan | status |
|------|------|--------|
| B1 org → family filter | `plans/004-org-family-filter.md` | PROPOSED |
| B2 benchmarks | `plans/005-benchmarks.md` | PROPOSED |
| B3 details panel | `plans/006-model-details-panel.md` | PROPOSED |
| B4 logos | `plans/007-logos.md` | PROPOSED |
| B5 data enrichment | `plans/008-data-enrichment.md` | PROPOSED |
| B6 multi-board arena | `plans/009-multi-board-arena.md` | PROPOSED |
| B7 search highlight | `plans/010-search-highlight.md` | PROPOSED |

Execution order is owner-chosen at review; items may be dropped, merged, or
reordered there.

## Out of scope (for this backlog)

- Backend, new deploy target, new chart library, i18n, PWA.
- Reopening 001's settled decisions (A1–A11).

## Definition of done

- [x] Owner reviews and approves this doc (process + item scoping).
- [x] Exploration findings appended per item (2026-09-16; per-item "Findings"
      sections below, produced by one research-only sub-agent per item).
- [x] Each surviving item graduated to its **own** `plans/00N-*.md` plan doc
      (004–010, PROPOSED — see Graduated plans; one plan per examination,
      merges only by explicit owner decision).
- [ ] Each plan is owner-reviewed; implementation starts only after agreement,
      in the owner-chosen order, following 001's commit-per-step discipline
      (tracked per plan; deferred to future sessions).
