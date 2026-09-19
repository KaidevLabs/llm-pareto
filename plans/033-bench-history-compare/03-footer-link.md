# Step 03 — Footer link — OPEN

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
