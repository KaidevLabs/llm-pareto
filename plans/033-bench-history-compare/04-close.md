# Step 04 — Close — OPEN

## Spec

No code changes (verification + docs audit only).

- Full verification hierarchy: `python3 -m unittest discover -s tests -v` +
  `npm test` + `npx tsc --noEmit` green → `npm run build` clean →
  `python3 update.py` passing (sane match report) → reviewed `public/data`
  diff untouched by this plan.
- 020 cookie probe over `/` **and** `/bench/compare.html` + its fetched JSONs
  (desktop + curl + mobile UAs, cookie-jar curl — recipe in
  `plans/archive/020-cookie-exploration.md`).
- README audit: the bench section documents run / coverage / cyc / publish /
  compare, matching shipped reality.
- Definition-of-done audit in `00-overview.md`.

## Closing procedure

1. Update plan files: this step's as-built + title, every execution-order
   row, the DoD.
2. Overview status → `ARCHIVED (date)` with the commit history.
3. Move `plans/033-bench-history-compare/` → `plans/archive/`, stage, commit
   — message suffixed `(plan: 033-bench-history-compare)`.
4. No push (Push policy) — the publish/compare/footer deploy rides the
   owner's next deliberate push to `main`.
