# Step 06 — Close — OPEN

## Spec

Verification-only close.

- Full gate: `python3 -m unittest discover -s tests -v` +
  `npm test` + `npx tsc --noEmit` → `npm run build` →
  `python3 update.py` (match report sane, history artifact written,
  `git status` shows the expected `public/data/history/` diff) →
  cookie probe at deploy time (owner-driven push; the `_headers` addition
  must re-run the 020 cookie probe — recipe in
  `plans/archive/020-cookie-exploration.md` — plus a header check that
  `/data/history/*` serves the immutable cache-control and no `Set-Cookie`).
- Definition-of-done audit against the overview.
- Grep audits: no `document.cookie`/`localStorage`/`sessionStorage`/
  `IndexedDB` in `src/` + `index.html` (020 rule, new files included).
- Update 026 doc status line: pointer to 043 (the exploration's graduated
  items).

## Verification

The commands above, all green, in the listed order.

## Seams under test

no tests: verification-only close step.
