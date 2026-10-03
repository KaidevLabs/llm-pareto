# Step 03 — Close — OPEN

## Spec

Standard close step:

1. Final verification: full python suite
   (`python3 -m unittest discover -s tests -v`).
2. Definition-of-done audit in `00-overview.md` — check items only with
   verifiable evidence.
3. As-built records for this step; overview status -> ARCHIVED with the
   plan's commit history; move `plans/044-frontier-walk/` to
   `plans/archive/044-frontier-walk/`.
4. Closing plan commit: `plan: 044-frontier-walk (plan: 044-frontier-walk)`
   — final state and archived plan in one commit.

No code changes expected; if the audit surfaces one, it becomes its own
mini-fix before this step closes.

## Verification

- `python3 -m unittest discover -s tests -v` green.
- `plans/archive/044-frontier-walk/` exists; `plans/044-frontier-walk/`
  does not.
- `git status` clean after the closing commit.

## Seams under test

- no tests: verification-only close step.
