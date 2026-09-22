# Step 04 — Footer link — ✅ COMPLETE (committed f2fc89d, 2026-09-22)

## Spec

- **`src/components/Footer.svelte`** — the `sources` line gains a same-origin
  link to the compare page: `<a href="/bench/compare.html">refactor bench</a>`
  (label wording owner-checked at review; it must read as bench/quality
  context next to the LMArena/OpenRouter source links).

**Not touched in this step:** anything else — one line of app chrome.

## Seams under test

`no tests: one-line chrome addition — covered by the component render via the
existing suite and the owner's feel-out.`

## Verification

```sh
npm test
npx tsc --noEmit
npm run build
grep -n "bench/compare" dist/index.html dist/assets/*.js   # link present in the bundle
```

Owner feel-out: link visible in the footer, navigates to the compare page.

## As-built

Shipped in `f2fc89d` — 2 lines in `src/components/Footer.svelte`: a `·`
separator + `<a href="/bench/compare.html">refactor bench</a>` between the
OpenRouter source link and the fetched-at stamp. Same-origin navigation (no
`target`/`rel`), matching the internal-link pattern.

Close verification (2026-09-22, `f2fc89d`):

- `npm test` 162/162 (19 files); `npx tsc --noEmit` clean; `npm run build`
  clean.
- `grep` finds `href="/bench/compare.html"` in
  `dist/assets/index-h4T--1LN.js` (no match in `dist/index.html` — expected;
  the footer lives in the bundle); `dist/bench/` carries the compare page so
  the href resolves.
- Feel-out served from the pre-existing `vite preview` on :4173 (fresh
  build): link renders in the sources line, `/bench/compare.html` → 200.
- Label `refactor bench` accepted at review (owner-checked wording, no change
  requested).
