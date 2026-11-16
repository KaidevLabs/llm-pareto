# 048 — One daily data run (cron 08:15 UTC)

Date: 2026-11-16. **Status: EXECUTED (2026-11-16).** D1–D6 approved by the
owner as the execution trigger; step 01 landed in `39867c3` (`.github/workflows/update-data.yml`
cron + `README.md` cadence sentence), pushed to `main`, and the workflow is
`active` on GitHub. Not archived yet: DoD item 3 — the first 08:15 UTC
scheduled firing — is still pending.
Source: triage of the 2026-11-12→16 `update-data` streak plus the owner's
decision in session (2026-11-16). Supersedes `047` D6 ("Cadence unchanged:
cron `15 */6 * * *`").

## Problem

Between 2026-11-13T06:24Z and 2026-11-16T00:43Z twelve scheduled runs went red
and emailed the owner (a thirteenth on 2026-11-12T06:22Z; that day's other two
failures were a different class — the provider-page `endpointStats` anchor,
fixed the same day in `7976926`): the arena source,
`datasets-server.huggingface.co/rows` for `lmarena-ai/leaderboard-dataset`
(`text`/`latest`), answered 501 (once 502, once 503) while HF re-indexed the
dataset after its ~04:00 UTC revision. Nothing in the code can shorten that:
the in-run policy is 3 attempts in ~6 s, and there is no zero-dep alternative
source (the dataset ships parquet only). Every failed run exits before writing,
so the site kept the last good data and `meta.fetched_at` showed its age — the
pipeline behaved, the frequency did not.

Two measured facts make 6 h the wrong cadence for this source:

1. **The arena board moves once a day.** Diffing the three runs of 2026-11-08:
   `arena.json` untouched in all three; on 2026-11-07 only the 06:25 run carries
   it (`4416 ++--`). Intraday movement is OpenRouter churn — `endpoints.json`
   ~23k lines of `uptime/throughput_last_30m` each run, `openrouter.json` 10–43
   lines, `combined.json` 8–33 lines.
2. **Every successful run commits anyway.** `write_history` stores a snapshot
   whenever the run's `fetched_at` is new (never indexed before) and the commit
   gate includes `history/`, so the current four runs/day are four commits and
   four Cloudflare builds/day regardless of whether the board moved.

Four runs a day also multiply one upstream failure by four: twelve red runs and
twelve emails for a single HF window.

## Settled decisions

| # | decision | rationale | date |
|---|----------|-----------|------|
| D1 | Cron becomes `15 8 * * *`: one run per day at **08:15 UTC**, ~4 h after HF's usual `~04:00` revision and off `:00` as 013 D4 requires. | Owner decision. Fresh enough (board is at most ~4 h old at fetch time) and past the revision itself. Known limit: on 2026-11-12 the viewer was still down at 12:22 (back by 14:44), so 08:15 does not dodge every window — see D5. | 2026-11-16 |
| D2 | The in-run retry policy is **unchanged**: `FETCH_ATTEMPTS = 3`, `RETRY_BASE_DELAY = 2` (waits 2 s, 4 s → ~6 s total) and `timeout-minutes: 10`. | Owner: ladders stay low — a normal run is ~3m30s and 7 min starts to cost Actions minutes across projects. A minute-scale ladder cannot cover an hours-scale window anyway; it only buys minutes-scale blips. | 2026-11-16 |
| D3 | **No** second workflow, watchdog, delayed re-dispatch, or `retry` input. One scheduled run and its in-process retries, nothing else. | Owner: "si hay una sola run programada debería haber la run y los reintentos no más". | 2026-11-16 |
| D4 | The failure-email step is untouched: one email per failed run, i.e. one per day. | Owner: "un email al día" is the outcome of D1, not a condition to enforce in the workflow. | 2026-11-16 |
| D5 | Accepted cost: when HF's re-index window is still open at 08:15, that day's refresh is lost. The site keeps the last good data, `meta.fetched_at` shows its age, and the next attempt is 08:15 the following day. | Owner: "no me importa perder un día". | 2026-11-16 |
| D6 | Supersedes 047 D6 (`15 */6 * * *`). | New source cadence plus the measured commit churn above. | 2026-11-16 |

## Not in scope

- Any change to `update.py` — retry policy, exit codes, a staleness guard, or
  skipping the run when the source is unavailable.
- A freshness/staleness alert independent of the fetch outcome.
- A parquet fallback source (would break the zero-dep rule).
- Editing archived plan docs (045/046/047) or `docs/reports/` that state the
  6 h cadence — historical record, left as written.

## Step 01 — the cron and the two places that state it

Files:

- `.github/workflows/update-data.yml`, `on.schedule` (line 6):
  `- cron: "15 */6 * * *"` → `- cron: "15 8 * * *"`.
- `README.md` (~line 53): "runs `python3 update.py` every 6 h (cron
  `15 */6 * * *` UTC)" → "runs `python3 update.py` once a day (cron
  `15 8 * * *` UTC)".

Verification:

- `git diff` shows exactly those two hunks and no other file.
- No YAML parser is available locally (`python3 -c "import yaml"` and
  `node -e "require.resolve('yaml')"` both fail); GitHub validates the workflow
  on push, and the real check is the first scheduled firing at 08:15 UTC.
- No code, data, or front-end file changes, so neither suite is affected.

Commit: `deploy: daily data refresh (cron 15 8 * * *)`

## Definition of done

- [ ] Owner approves D1–D6.
- [ ] The two edits land; `git diff` limited to them.
- [ ] The first scheduled run fires at 08:15 UTC (modulo GitHub schedule delay)
      and either commits normally or fails for a documented upstream reason.
- [ ] 047 D6 recorded as superseded by this doc; archived plans untouched.
