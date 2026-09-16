# 017 — TDD discipline + test suite (unittest baseline, node:test principle)

Date: 2026-09-16. **Status: EXECUTING — steps 1–4/5 executed (suite, AGENTS.md
Testing, tdd skill, plans skill committed); step 5 (close audit) remaining.**
Source: owner request (session, 2026-09-16) — the agent probes in `.tmp/` instead of
test-first; make plan execution start at tests. No backlog item.
Amendment 2026-09-16 (owner directive mid-step-1): the README gains a Tests
section (suite layout + commands) and a `tests/` layout line, so the testing
rules are discoverable from the repo entry point — committed with the
step-1 code.

Make TDD actually happen: plan execution starts at a failing test at a declared
seam and ends with kept tests, instead of throwaway `.tmp/` probes. This needs
three surfaces fixed together: the repo gains the test infrastructure the `tdd`
skill already assumes exists, the `tdd` skill gets test-first + fail-fast rules,
and the `plans` skill stops letting seam declaration be silently skipped.

## Diagnosis (why TDD never fired — evidenced)

1. The trigger never fired: the `tdd` skill was created 2026-09-16 inside step
   commit `b3089a3` (001's last chart step); no behavior-changing step has been
   executed since (004–016 all PROPOSED; the day's work since = research-only
   exploration + data runs).
2. Dangling dependency: the skill defers test conventions and the standard
   single-test command to "the repo's testing rules (its agent guidelines)" —
   this repo's AGENTS.md has no testing section, no framework, no `tests/`
   (verified). A willing executor hits a wall and degrades to `.tmp/` probes.
3. `plans` skill: "Seams under test" is **optional** — nothing forces a plan
   author to declare seams or justify not testing.
4. AGENTS.md names the test-free default: "A change is verified by
   `python3 update.py` passing". Evidence of the result: `.tmp/b6–b13` (fetched
   HTML, JSON dumps, `fam-check.mjs`) — all discarded at close.

## Settled decisions (discovery session with owner, 2026-09-16 — do not revisit)

| # | decision | rationale |
|---|----------|-----------|
| A1 | Python framework: **unittest** (stdlib) | zero-dep ethos of the repo (`update.py` is deliberately zero-dep); always present; suite volume (join/normalize logic) doesn't justify a dev dependency |
| A2 | JS principle: pure logic of `app.js` (Pareto, filters, formatting) is testable via **node:test** (built-in, zero-dep); the ESM split of `app.js` lands as step 0 of the **first dashboard plan that needs it** — not before, not speculatively | no concrete consumer yet; rendering/DOM behavior stays manual A/B (owner's working style); jsdom/vitest ruled out (dependencies) |
| A3 | Baseline suite for the **existing** `update.py` logic: `normalize`, `match_arena`/`join` (suffix rules, ambiguity→override, fuzzy threshold), `validate` thresholds, `parse_arena` | concrete consumer exists: the join gates every data commit and carries subtle rules verified today only by running and eyeballing the diff |
| A4 | Fixtures: **synthetic** hand-written minimal RSC-shaped payload(s) exercising the 18-field schema edges — not real page snapshots | readable, stable against unrelated arena.ai churn; schema drift is `update.py` fail-fast's job, not the fixture's |

## Current state (evidence)

- `update.py` 478 lines, pure functions: `_extract_json_array`:74,
  `parse_arena`:106, `normalize`:178, `match_arena`:222, `join`:255,
  `validate`:337. No `tests/` dir; no test framework configured anywhere.
- `app.js` is a plain browser script (no exports/imports,
  `<script src="./app.js">`) — untestable without the A2 split.
- Commands: `python3 -m unittest discover -s tests` (all),
  `python3 -m unittest tests.test_normalize` (single file),
  `python3 -m unittest tests.test_normalize.TestNormalize.test_strips_suffix`
  (single test). Python 3.14.7 local.

## Steps (commit per step; owner stages each diff)

1. Baseline suite: `tests/` (unittest) — `test_normalize`, `test_match_join`
   (suffixes -high/-xhigh/-max stripped, -medium/-low preserved, tier
   `:suffix` stripped, ambiguity → override, fuzzy 0.95), `test_validate`
   (thresholds), `test_parse_arena` (+ synthetic fixture). Tests document
   current behavior **as-is**; a test that exposes a bug is reported to the
   owner and fixed by separate decision — never silently in this step. Verify:
   `python3 -m unittest discover -s tests -v`. Commit: `test: baseline suite for update.py`
2. AGENTS.md: new **Testing** section — A1 framework + commands, `tests/`
   layout, synthetic-fixture convention, the A2 JS principle (one line), and
   the verification hierarchy (suite green + `update.py` run + reviewed diff).
   Commit: `docs: testing rules in AGENTS.md`
3. `tdd` skill rework: (a) test-first — the step's first act at a seam is the
   failing test (expected values written before implementation); (b) fail-fast
   — if the repo has no standard test command, stop: making it exist is part
   of the step, never degrade to throwaway probes; (c) probe → kept test — a
   `.tmp/` probe that verifies step behavior becomes a kept test before the
   step closes. Commit: `docs: tdd skill — test-first and fail-fast rules`
4. `plans` skill: "Seams under test" no longer optional for behavior-changing
   steps — declared seams **or** an explicit `no tests: <reason>` line the
   owner reviews. Commit: `docs: plans skill — seams mandatory or explicit opt-out`
5. Close: full suite green + `python3 update.py` sanity run (no diff surprises)
   + DoD audit. (Verification-only.)

## As-built

### Step 1 (2026-09-16, commit a514f4d)

- 54 tests: test_normalize (12), test_match_join (18), test_validate (16),
  test_parse_arena (9). `discover -s tests` green in ~0.01s; all three
  planned invocation forms work from repo root; no `__init__.py` or
  sys.path boilerplate needed (`python -m` puts the cwd on sys.path).
- No bug exposed — every behavior rational, pinned as-is. Findings locked
  by tests:
  - `:(batch|free)$` tier stripping was never generic (regex unchanged since
    init 18c68c5); the earlier "generic :token" note (memory #341) was
    stale — corrected. `foo:nodebug` keeps its colon.
  - Space removal inserts no dashes (`Claude Sonnet 4.5 (Thinking)` →
    `claudesonnet4-5`): spaced arena names join only via fuzzy — e.g.
    `Mistral Medium` → `mistral-medium` at 0.96, just over the 0.95 gate.
  - `-medium`/`-low` survive normalization, yet `gpt-5.5-low` still joins
    via prefix-base to `openai/gpt-5.5`.
- Probes (`.tmp/`) deleted; their assertions live on as kept tests.
- README Tests section added per owner directive (see amendment above).

### Step 2 (2026-09-16, commit 497eccc)

- AGENTS.md's stale Verification section ("No test suite exists") replaced
  by **Testing**: suite + the three command forms, `test_<unit>.py` layout,
  characterization discipline (red-after-change = review signal, red→green
  via the `tdd` skill), synthetic-fixture convention, the A2 node:test
  one-liner, and the verification hierarchy (suite → `update.py` run →
  reviewed diff, `meta.json` first).
- The single-test example command was verified against the live suite.
- Resolves diagnosis #2: the `tdd` skill's "repo's testing rules (its agent
  guidelines)" reference now lands on real rules. The skill's own rework
  (explicit reference + test-first/fail-fast rules) is step 3; DoD item 4
  stays unchecked until then.

### Step 3 (2026-09-16, commit 6b8042f)

- `tdd` skill rework, all three plan clauses:
  - (a) test-first: "Red before green" sharpened — the step's first act at a
    declared seam is the failing test, expected values written before any
    implementation.
  - (b) fail-fast: new first loop rule — no standard test command in the
    testing rules → stop; creating it is part of the step, declared at
    review, never improvised; never degrade to throwaway probes.
  - (c) probe → kept test: new "Throwaway probing" anti-pattern — a probe
    that proves behavior is scaffolding; before step close its assertions
    are promoted into kept tests at the declared seam and the probe is
    deleted.
- Dangling reference killed (completes DoD item 4 with 497eccc): the intro
  and Rhythm bullet now name "AGENTS.md, Testing section" explicitly; the
  foreign example command (`... test --compact ...`) is gone.

### Step 4 (2026-09-16, commit 62cc5a1)

- `plans` skill, "Seams under test": `(optional)` dropped — a behavior-
  changing step declares seams **or** carries an explicit `no tests: <reason>`
  line the owner reviews; "never ships silently untested."
- Lifecycle consistency: the Executing section's "steps without seams follow
  their verification directly" (the backdoor around the new rule) now routes
  only `no tests:` opt-outs and non-behavior-changing steps down that path.

## Out of scope

- ESM split / any JS tests now (A2 — candidate trigger: 004 org/family filter).
- DOM/rendering tests; jsdom, vitest, pytest (all dependencies).
- CI (GitHub Actions) — tests run locally; revisit if missed runs become a pattern.
- Changing `update.py` behavior: the baseline suite documents behavior as-is.

## Definition of done

- [x] Owner approves this plan (A1–A4) in a review session. (owner execute
      directive, session 2026-09-16)
- [x] `python3 -m unittest discover -s tests -v` green; covers normalize,
      match/join, validate thresholds, parse_arena; fixtures synthetic.
      (54 tests green, 2026-09-16)
- [x] Suite passes against current `update.py` with **zero** `update.py` edits
      (git diff shows none). (commit a514f4d touched tests/ + README only)
- [x] AGENTS.md Testing section exists; `tdd` skill references it instead of
      dangling; no "repo testing rules" dead end. (AGENTS.md 497eccc; tdd
      skill 6b8042f names "AGENTS.md, Testing section" in intro + Rhythm)
- [x] `plans` skill: seams mandatory-or-explicit for behavior-changing steps.
      (62cc5a1: `(optional)` dropped + lifecycle backdoor closed)
- [ ] Observable at the next behavior-changing plan's review: its steps ran
      red → green (kept tests exist afterwards).
