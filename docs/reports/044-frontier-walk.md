# 044 — Frontier walk: objective model selection without a static score

*Report of plan 044 (steps 01–02), 2026-10-03. All numbers are pasted from
`python3 -m tests.frontier_walk` (module committed in 2deeef1) and the
scratch stability probe `.tmp/044_stability.py` over
`public/data/combined.json` + `endpoints.json` + the 19
`public/data/history/` snapshots — re-running the CLI reproduces every
figure below.*

## 1. The walk table

The 2-D price/Elo Pareto frontier on live data (2026-10-03) has **9
points**, listed price-ascending:

| # | model | $/M out | Elo [CI] | tok/s |
|---|-------|--------:|----------|------:|
| 1 | deepseek/deepseek-v4-flash | 0.056 | 1438.4 [1434.3, 1442.5] | 56 |
| 2 | xiaomi/mimo-v2.6-flash | 0.28 | 1451.8 [1443.9, 1459.6] | 36 |
| 3 | google/gemma-4-31b-it | 0.34 | 1452.8 [1445.4, 1460.3] | 22 |
| 4 | deepseek/deepseek-v4-pro | 0.4176 | 1464.3 [1457.7, 1470.9] | 46 |
| 5 | z-ai/glm-5.3-flash | 0.5 | 1473.0 [1467.7, 1478.3] | 41 |
| 6 | xiaomi/mimo-v2.6-pro | 0.87 | 1480.1 [1470.7, 1489.5] | 31 |
| 7 | google/gemini-3.8-flash | 3.75 | 1494.8 [1489.7, 1499.8] | 104 |
| 8 | anthropic/claude-opus-5.5 | 20 | 1503.7 [1494.6, 1512.8] | 72 |
| 9 | anthropic/claude-opus-4.6 | 25 | 1504.7 [1501.3, 1508.1] | 38 |

The walk — each consecutive pair, with the local exchange rate (price
multiple = ratio-scale, Elo gain = interval-scale difference, tok/s delta)
and the `inside_ci` flag (the pair's Elo confidence intervals overlap, i.e.
the "gain" is statistically indistinguishable from zero):

| step to | price multiple | Elo gain | tok/s delta | inside_ci |
|---|---|---|---|---|
| mimo-v2.6-flash | ×5.00 | +13.4 | −20 | no |
| gemma-4-31b-it | ×1.21 | +1.1 | −14 | **yes** |
| deepseek-v4-pro | ×1.23 | +11.4 | +24 | **yes** |
| glm-5.3-flash | ×1.20 | +8.7 | −5 | **yes** |
| mimo-v2.6-pro | ×1.74 | +7.1 | −10 | **yes** |
| gemini-3.8-flash | ×4.31 | +14.7 | +72 | no |
| claude-opus-5.5 | ×5.33 | +8.9 | −32 | **yes** |
| claude-opus-4.6 | ×1.25 | +1.0 | −34 | **yes** |

**Interpretation.** Only two steps are unambiguous upgrades:

- **deepseek-v4-flash → mimo-v2.6-flash**: ×5 price buys +13.4 Elo outside
  any CI overlap. Real, and the largest per-multiple Elo gain on the curve
  (~+8.1 Elo per price multiple). Everything after it up to gemini is noise
  territory: six consecutive steps whose Elo gains (1.0–11.4) all sit
  inside overlapping CIs.
- **mimo-v2.6-pro → gemini-3.8-flash**: ×4.31 price for +14.7 Elo *and*
  +72 tok/s — the only step that improves quality and speed at once. Real.
- **opus-5.5 → opus-4.6**: ×1.25 for +1.0 Elo inside CI while *losing*
  34 tok/s. The top of the curve is a horizontal shelf: opus-4.6 is only
  on the frontier because its CI is the narrowest at the top — pay 25
  $/M for the *tightest* claim to ~1505, not for a higher one.

The middle of the curve (steps 3–6) is best read as "any of these five
models between 0.34 and 3.75 $/M are Elo-tied within noise; price and
speed decide, not the leaderboard."

## 2. The supported set

Upper convex hull of the frontier in (log10 price, Elo) — the points some
linear index `a·elo − b·log10(price)` can rank #1:

- **Supported (6):** deepseek-v4-flash, glm-5.3-flash, mimo-v2.6-pro,
  gemini-3.8-flash, claude-opus-5.5, claude-opus-4.6
- **Unreachable (3):** mimo-v2.6-flash, gemma-4-31b-it, deepseek-v4-pro

All three unreachable points sit on the same hull edge
(deepseek-v4-flash → glm-5.3-flash, slope a ≈ 36.4 Elo per decade of
price). The worked gemma example, from the probe:

- gemma-4-31b-it costs 0.34 $/M at Elo 1452.8. The chord through its two
  supported neighbours passes Elo **1466.91** at that price; gemma misses
  it by ~14 Elo points (hull cross ≈ 13.4 > 0, strictly below the hull).
  Equivalently: the best index tuned to that edge scores
  index(deepseek-v4-flash) = 52312.0, index(gemma) = 52835.4,
  index(glm-5.3-flash) = 53568.5 — gemma lands strictly between the two
  endpoints, so no weight pair can ever put it first.
- Same shape for mimo-v2.6-flash (needs Elo ≥ 1463.84 at 0.28 $/M) and
  deepseek-v4-pro (needs ≥ 1470.16 at 0.4176 $/M).

**Why this kills the static index.** These three models are the interesting
answers to real questions — "the cheapest model above 1450", "the best
sub-0.5 $/M coder" — and *no* linear score can ever surface them as #1.
That is not a tuning failure, it is a theorem about their position in the
curve: they are concave dips, dominated by *no* single point but beaten at
every exchange rate. This is why plan 044 replaces the index with the walk
+ gate+direction classes.

## 3. Task-class champions

Three classes, each a hard Elo gate plus one optimization direction —
never a weight vector (044 A2/A3). The gates are analysis parameters
chosen for this snapshot, not derived constants (044 A5):

| class | gate | justification | direction | champion | runner-up |
|---|---|---|---|---|---|
| batch-cheap | Elo ≥ 1450 | excludes the cheapest tier's Elo (deepseek-v4-flash at 1438) while keeping the sub-1 $/M cluster — "unattended work needs *usable* quality" | min_price | **xiaomi/mimo-v2.6-flash** (0.28 $/M, Elo 1451.8) | google/gemma-4-31b-it (0.34 $/M, Elo 1452.8) |
| speed-critical | Elo ≥ 1470 | the glm-5.3-flash tier — "interactive use needs near-frontier quality" | max_speed | **meta/muse-spark-1.1** (205 tok/s, Elo 1491.3) | meta/muse-spark-1.2 (171 tok/s, Elo 1493.5) |
| frontier-quality | Elo ≥ 1500 | only the Opus-class shelf clears it — "quality is the product" | max_speed | **anthropic/claude-opus-5.5** (72 tok/s, Elo 1503.7) | anthropic/claude-fable-5 (57 tok/s, Elo 1504.3) |

Notes the gate+direction framing surfaces for free:

- batch-cheap's champion and runner-up are both *unsupported* frontier
  points (§2) — exactly the answers a static index would never give.
- speed-critical's top two are CI-tied (overlap: yes), so the 205-vs-171
  tok/s ordering is the real decision criterion — the gate+direction form
  makes the tie-break explicit instead of burying it in weights.
- frontier-quality's champion (opus-5.5) and runner-up (fable-5) are also
  CI-tied; the class picks opus-5.5 purely on throughput.

## 4. Stability across the 19 snapshots

Recomputing frontier + supported set + champions over every
`public/data/history/` snapshot (2026-09-16 → 2026-10-02, ~17 days,
6-hourly bot refreshes):

- **Frontier size oscillates 7–12 points**; the supported count is
  remarkably stable at 6 (twice 5): the *shape* of the curve — one big
  concave dip cluster, 3-ish unreachable points — is the durable
  structure, while individual points enter and leave.
- **Champion holds:**
  - batch-cheap: glm-5.3-flash **14/19**, mimo-v2.6-flash 3/19,
    hy3 1/19. Both flips were real (outside CI): on 09-22 hy3 entered at
    1455.8 [1448.6, 1463.0] and undercut glm-5.3-flash (1475.4
    [1468.8, 1482.0]) on price; on 09-29 mimo-v2.6-flash did the same.
  - speed-critical: claude-fable-5 **16/19**, grok-4.20-multi-agent
    2/19 (09-29, 10-01/02 data window). The grok flip was *not* an Elo
    event — grok-4.20-multi-agent sat at 1470.6 [1466.9, 1474.3] vs
    fable-5's 1504.3 [1499.9, 1508.7] (no overlap) and won purely on
    344 tok/s; in the live 2026-10-03 data it has **lost every endpoint
    with rc ≥ 30** (speed = None) and drops out of the class entirely.
    Live champion is muse-spark-1.1 (205 tok/s). Champion selection in a
    speed class is therefore exposed to speed-coverage churn, not just
    leaderboard movement — a single model's endpoint stats disappearing
    flips the class.
  - frontier-quality: claude-fable-5 **16/19**, claude-opus-5.5 2/19.
    The one flip (09-29) was *inside* CI (opus-5.5 1508.6 [1496.3, 1520.8]
    vs fable-5 1503.8 [1499.4, 1508.3], intervals overlap) — noise-tied
    shelf, exactly as the walk table predicts.
- **Gate sensitivity:** the batch-cheap gate at 1450 sits right on the
  deepseek-v4-flash boundary (Elo 1438.4 [1434.3, 1442.5]); lowering the
  gate to ~1435 flips the class to deepseek-v4-flash at 0.056 $/M — a 5×
  price change triggered by a 15-point gate move. Gates this close to a
  frontier point's CI edge should be treated as load-bearing choices.

## 5. What this cannot compute today

- **Per-board task Elo.** The walk uses the text-board Elo only. The 11
  arena boards (webdev, vision, search, …) are per-task Elo scales that
  `update.py` does not fetch (#354 open branch). "Batch-cheap" for *code*
  vs *chat* is therefore not computable — the classes above are
  text-board generalizations. A data plan fetching non-text boards would
  unlock gate+direction per board, the natural evolution of §3.
- **Revealed preference.** Whether the owner's actual choices agree with
  the class champions requires a choice log, which does not exist (open
  branch, parked). No weight fitting is possible without it — and §2
  argues no weights should be fitted anyway.
- **Latency vs throughput.** Speed here is the p50-throughput median
  (rc ≥ 30 rule, identical to the site's `speedOf`). Interactive
  latency (TTFT) is a different axis the endpoints layer does not
  currently expose per model.

## 6. Graduation proposal

A follow-up UI plan could render, without any new data fetch:

| item | what it renders | what it fixes |
|---|---|---|
| Drawer "next step up" | for the selected point, the next frontier step: "×N price for +K Elo (CI-tied: yes/no)" | the explorer currently shows *that* a point is frontier; it cannot show what the next step costs |
| Class badges | chip per row naming the class(es) whose champion it is (e.g. batch-cheap, speed-critical) | makes the §3 champions visible without a static score column (out of scope for 044) |
| Walk strip | a 9-node strip over the frontier with per-step Elo gain and CI-hatch on noise-tied steps | visualizes the "Elo-noise-tied middle" that today reads as a smooth curve |
| Speed-coverage flag | mark champions whose speed map thinned vs the previous snapshot (the grok-4.20 case) | the speed dimension currently degrades silently to "n/a" |

The drawer item is the cheapest and most defensible; the walk strip is the
one that would make §1's noise story legible to a visitor.