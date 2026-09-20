# 040 — Bundle echarts from npm (treeshake + dynamic GL chunk)

Date: 2026-09-20. **Status: PROPOSED — not reviewed, not executed.**
Source: `docs/reports/030-port-perf-findings.md` B28 (owner question
2026-09-20: "what if we add echarts via package.json?"). **Absorbs B23's
typing scope** (the plan `037-chart-typing.md` is superseded by this one;
its residual — the two component type holes — is already step 5 of
`plans/039-hygiene-batch.md`).

Measured (probe: `.tmp/echarts-probe/`, echarts 5.6.0 via npm, vite + our
minify, treeshaken to exactly our feature set — custom/line/scatter +
grid/tooltip/inside-zoom + canvas):

| | vendored today | npm + treeshake |
|---|---|---|
| eager echarts | 1,034,102 B / 335 KB gz | 505,771 B / **166 KB gz** (−50%) |
| echarts-gl (lazy) | 639,846 B / 175 KB gz | ~unchanged, as a dynamic-import chunk |
| eager JS total | ~378 KB gz | ~215 KB gz (−43%) |

Secondary wins: the parse-blocking body-end classic script disappears (the
bundle is defer by nature — without any shell this alone moves throttled
FCP ~3.3 s → ~1.5–2 s); real `EChartsOption` types replace the
`declare const echarts: any` seam; the `gl.ts` script-inject becomes
`await import("echarts-gl")` (same #468 invariant: await before init).
Not an FCP fix: B19's static shell (~0.6 s) still wins alone; they compose.
Chart-ready stays dominated by data + badge logos (B20).

## Proposed decisions (settled at owner review)

| # | decision | options & recommendation |
|---|----------|--------------------------|
| D1 | Adopt `echarts@5.6.0` (exact pin) from npm | Treeshaken imports per the probe's set. The 019 **byte-pin audit → lockfile pinning** (package-lock integrity hashes) — same supply-chain guarantee, amended mechanism; 020 untouched (bundled = self-hosted, zero third-party requests). Remove `public/js/echarts-5.6.0.min.js`. **(rec) yes.** |
| D2 | `echarts-gl@2.1.0` from npm too | `await import("echarts-gl")` → automatic lazy chunk; delete `gl.ts`'s script-inject; the #468 invariant (GL registered before instance creation) holds by awaiting before `echarts.init`. Remove `public/js/echarts-gl-2.1.0.min.js`. Alt (keep vendored gl + inject): rejected — two mechanisms for one job. **(rec) yes.** |
| D3 | Version policy | Exact-pinned 5.6.0/2.1.0 to match the vendored behavior byte-for-byte in spirit; any bump is a deliberate re-audit (cookie grep + GL probes + A/B), never a routine dependabot merge. **(rec) yes.** |
| D4 | charts.ts typing (absorbed B23) | `import * as echarts from "echarts/core"` + typed instances + `EChartsOption` on the option builders; **zero behavior change** (suites stay green untouched). **(rec) yes.** |
| D5 | Verification gate | DoD carries the bundle numbers (eager JS ~215 KB gz, from ~378) + suites + `npx svelte-check` 0 errors on the seam + CDP probes for the chart/GL seams + cookie grep on the built bundle + harness load A/B (FCP/chartMs unchanged-or-better; zoom settle unaffected). |

## Steps (commit per step; owner stages each diff)

1. Deps + imports: add echarts/echarts-gl, swap charts.ts + gl.ts to
   module imports, delete both vendored files, dynamic GL chunk.
   Commit: `chart: npm echarts (treeshake + lazy gl chunk)`.
2. Typing pass (D4) on the same imports. Commit: `chart: type the
   echarts seam` (absorbed B23).
3. Verification (D5) + owner A/B; DoD audit. Commit: foldable.

## Out of scope

- The static shell (034) and badge store (035) — independent, compose.
- echarts version bump / upgrade — pinned (D3), separate decision.
- Any render-behavior change (the A2/A4 imperative seam stays).

## Definition of done

- [ ] Owner approves D1–D5 in a review session.
- [ ] Eager JS measured ≈ 215 KB gz (from ~378); GL chunk lazy and ~unchanged.
- [ ] Zero behavior change: suites green untouched; chart/GL probes pass;
      zoom/pan trailing unchanged (018 A2).
- [ ] `npx svelte-check` 0 errors on the seam; cookie probe clean.
- [ ] 019's audit note amended to the lockfile mechanism; vendored files gone.
