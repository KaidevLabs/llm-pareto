# 013 — Automated update + deploy (cron)

Date: 2026-09-16. **Status: EXECUTING (step 3/3; step 4 is post-review).**
Source: `plans/archive/003-exploration-backlog.md` item B10 + its exploration findings.

Unattended `update.py` refresh on a schedule, with controlled deploy semantics
— amending the A1/A8 "manual updates only" convention by explicit owner
decision. A failed run deploys nothing; the site always serves last-good data.

Owner approved execution 2026-09-17 (DoD item 1; "Execute plan
@plans/013-auto-update.md" + step-level staging).

## Settled decisions (owner-approved 2026-09-17 — do not revisit)

| # | decision | rationale |
|---|----------|-----------|
| D1 | Transport: GitHub Actions — `schedule` workflow (public repo, standard `ubuntu-latest`, $0) + `workflow_dispatch`; `permissions: contents: write, pull-requests: write` | measured: `update.py` is zero-dep, fail-fast, 1.76 s, 2 unauthenticated fetches; GH Actions is free on public repos; no Cloudflare secret needed — the CF git-integration deploys on push (003 B10 findings) |
| D2 | Review semantics: **a PR per changed run** (owner merges) — preserves the data-diff + match-report discipline; the workflow never pushes to main directly | 003 B10 option (b); auto-push to main (option a) silently drops the review; hybrid (c) needs a machine-readable match report — deferred (open question 3) |
| D3 | Changed-gate: open a PR only if `arena.json`, `openrouter.json` or `combined.json` changed — `meta.json` excluded | measured flaw: `meta.fetched_at` changes on every run, so a gate on all 4 files always fires; the measured no-op run = a 1-line meta.json diff (003 B10/B13) |
| D4 | Cadence: every 6 h, cron offset off `:00` (e.g. `15 */6 * * *`) | arena text cutoff moves ~daily; OR price drift is intra-day but usually non-visible (measured); hourly = PR churn, daily = up to ~36 h stale including schedule-delay risk |
| D5 | `update.py` pre-step: 1–3 retries with backoff on fetch (a transient 5xx / >60 s timeout currently kills the run) | single fetch, no retry (update.py:50-62); fine by hand, flaky under cron (003 B13 candidate 13) |
| D6 | Failure visibility v1: the Actions red run + match report in the log is enough; no monitoring added yet | measured: zero monitoring today; the dead-man's switch is a later step (open question 5) |

Evidence (compressed; full measured tables in the 003 findings): `update.py`
profile (478 lines, stdlib only; thresholds top-20 ≥18/20 and overall ≥40 % —
currently 20/20 and 52.2 % with measured headroom; atomic writes; the match
report = the review surface; 192 arena unmatched is normal); GH Actions facts
verified against live docs (schedule free for public repos, 5-min minimum,
`:00` high-load peak, 60-day auto-disable, GITHUB_TOKEN is same-repo only,
pushes do not re-trigger other workflows); CF git-integration auto-deploys on
push (docs, updated 2026-05-29); a red run → no commit/PR, the only signal is
the red run + log; `overrides.json` currently 1 entry (slow drift — a
weekly-ish manual review is enough for now).

## Open questions (settled at the examination session)

1. D2: PR vs auto-push to main vs hybrid — the owner's call (amends A1/A8).
2. D4 cadence (6 h proposed; hourly / daily are the alternatives).
3. Hybrid path: does `update.py` emit a machine-readable match summary (stdout
   JSON or committed file) to enable a "clean run → auto-merge" policy + a
   "new unmatched names" signal for `overrides.json` maintenance?
4. `overrides.json` maintenance scope: the workflow auto-suggests overrides
   from the unmatched list, or does it stay purely manual?
5. Monitoring: dead-man's switch / "data is N h old" badge (003 B13 #10/#5) —
   ship after the cron is live.
6. Deploy hygiene: the local `npx wrangler deploy` leaks `/.wrangler/cache/*`
   into the public surface (003 B8 finding) — settle before or with cron (clean
   local path, or exclude the cache dir from assets).
   **RESOLVED 2026-09-17 (step 2):** measured on wrangler 4.133.0 — the config
   schema has no `assets.exclude` and a `--dry-run` asset count goes 36 → 39
   with a fake `public/.wrangler/cache/wrangler-account.json` present, so the
   clean-local-path option is the only repo-side fix: always run wrangler from
   the repo root (cache → gitignored root `.wrangler/`, never inside
   `public/`) and `rm -rf public/.wrangler` before a manual deploy; the cron
   path is structurally immune (fresh checkout / fresh CF clone). The README
   documents this; revisit if upstream adds an assets exclude.

## Steps (commit per step; owner stages each diff)

1. `update.py`: fetch retry (D5) — 1–3 attempts, backoff, same fail-fast on
   final failure. Verification: `python3 update.py` green; simulate a 5xx
   (scratch) and confirm the retry.
   Commit: `update: retry transient fetch failures`
   — **✅ COMPLETE (committed 3c5d823, 2026-09-17)**
   As-built: 3 attempts total (1 initial + 2 retries); backoff 2s → 4s
   (RETRY_BASE_DELAY doubled per retry); retry set = HTTP 5xx, 429, timeouts,
   connection-level errors (URLError/ConnectionError) — 429 added beyond
   D5's "5xx/timeout" as transient (flagged to the owner at step-1 review;
   staged and accepted);
   other 4xx fail fast with no sleep. Each retry prints to stdout (Actions
   log, D6); final failure keeps the original die() message. 8 new
   characterization tests at the update.fetch seam (tests/test_fetch.py,
   urlopen/sleep mocked); suite 105 → 113. Verified: full suite green; live
   run green (1.6 s, real drift caught and left to the next data commit per
   B10 precedent); simulated 503 on first attempt → retry line in log after
   2 s → success, payload intact.
2. `.github/workflows/update-data.yml`: schedule (D4) + dispatch; checkout,
   setup-python, `python3 update.py` (match report to the log, non-zero = red);
   D3 gate; PR creation (D2) with the match report in the PR body.
   Commit: `ci: scheduled data-update workflow (PR per changed run)` —
   **✅ COMPLETE (committed c5d6c43, 2026-09-17)**

   As-built: cron `15 */6 * * *` UTC + `workflow_dispatch`; permissions
   `contents: write` + `pull-requests: write`; `concurrency` group
   `update-data` (serializes a delayed schedule vs a manual dispatch); 10-min
   timeout. Run step: report → `.tmp/update-report.txt` (needs `mkdir -p
   .tmp` — gitignored dirs don't exist in Actions checkouts; caught in the
   rehearsal), echoed to the log, exit code preserved (red run → no PR). Gate
   verbatim D3 (`git diff --name-only` over arena/openrouter/combined.json;
   meta.json-only → green no-op, log line "No data changes"). On fire:
   timestamped branch `data/auto-update-<stamp>`, commit
   `data: scheduled refresh (<stamp>)` staging `public/data` +
   `public/assets/logos` + `logos.json` (a committed meta.json logos-map must
   not reference uncommitted logo files), PR body = stamp + run link + fenced
   match report, `gh pr create` on `main` with `GITHUB_TOKEN`.
   Q6 RESOLVED (evidence: wrangler 4.133.0 config schema has no `assets.exclude`
   and a `--dry-run` asset count goes 36 → 39 with a fake
   `public/.wrangler/cache/wrangler-account.json` present — dot dirs are still
   uploaded today): decision = always run wrangler from the repo root (cache
   lands in the gitignored root `.wrangler/`, never inside `public/`) and
   `rm -rf public/.wrangler` before a manual deploy; the cron path is immune
   (fresh checkout → no local cache; fresh CF clone → no local cache).
   Revisit if upstream wrangler adds an assets exclude. Recorded in README
   ("Deploy hygiene (wrangler)").
   README (DoD item 6): new "Scheduled (default)" section documenting the
   cron + PR + merge → CF auto-deploy flow; stale "if continuous git builds
   get enabled" note replaced with the live-verified fact (deployed
   meta.json == committed — git integration active on push); the manual
   commit line now also stages `logos.json` + `public/assets/logos`.
   Verified: actionlint clean (before + after the `mkdir -p .tmp` fix), YAML
   parses, and a full dress rehearsal in a scratch clone against a bare remote
   ran the extracted `run:` blocks verbatim — no-op path (message + exit 0,
   clean tree, no branch) and changed path (real `python3 update.py` → gate
   fired on the 3 drifted files → branch `data/auto-update-<stamp>` + commit
   of exactly the 4 data files + correct PR body + push OK; `gh pr create`
   failed only for wanting a GitHub remote, as expected off GitHub).
3. Owner merge cycle: run once, review the first PR end-to-end (diff + report),
   merge, verify the CF auto-deploy.
4. Later (post-review): freshness surface + dead-man's switch (open question 5).

## Out of scope

- Local Linux server transport (measured viable; kept as the fallback if
  schedule-drop or free-tier limits bite).
- Any change to the join / validation logic (only the D5 retry).
- The freshness badge / changelog UI (016 candidates #4/#6 — data-side only
  here).

## Definition of done

- [x] Owner approves this plan (D1–D6) in a review session. (2026-09-17:
      "Execute plan @plans/013-auto-update.md" + step-level staging; D1–D6 as
      proposed, no amendments)
- [ ] A scheduled run produces a green Actions run + a PR when data changed, and a no-op green run when nothing changed.
- [ ] A failing run (forced 5xx / threshold violation) leaves no PR and no deploy; the site serves last-good data.
- [ ] A merged PR auto-deploys via the CF git-integration (verified live).
- [x] The `/.wrangler/` leak decision (open question 6) is recorded.
      (2026-09-17: RESOLVED — evidence + decision in step 2 as-built;
      recorded in README "Deploy hygiene (wrangler)")
- [x] README documents the new flow (the manual flow stays available).
      (2026-09-17: "Scheduled (default)" + "Manual" + "Deploy hygiene"
      sections, committed c5d6c43)
