# 017 — TDD discipline + test suite (unittest baseline, node:test principle)

Date: 2026-09-16. **Status: PROPOSED — not reviewed, not executed.**
Source: owner request (session, 2026-09-16) — the agent probes in `.tmp/` instead of
test-first; make plan execution start at tests. No backlog item.

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

## Out of scope

- ESM split / any JS tests now (A2 — candidate trigger: 004 org/family filter).
- DOM/rendering tests; jsdom, vitest, pytest (all dependencies).
- CI (GitHub Actions) — tests run locally; revisit if missed runs become a pattern.
- Changing `update.py` behavior: the baseline suite documents behavior as-is.

## Definition of done

- [ ] Owner approves this plan (A1–A4) in a review session.
- [ ] `python3 -m unittest discover -s tests -v` green; covers normalize,
      match/join, validate thresholds, parse_arena; fixtures synthetic.
- [ ] Suite passes against current `update.py` with **zero** `update.py` edits
      (git diff shows none).
- [ ] AGENTS.md Testing section exists; `tdd` skill references it instead of
      dangling; no "repo testing rules" dead end.
- [ ] `plans` skill: seams mandatory-or-explicit for behavior-changing steps.
- [ ] Observable at the next behavior-changing plan's review: its steps ran
      red → green (kept tests exist afterwards).
