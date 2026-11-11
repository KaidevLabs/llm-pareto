# Step 02 — The workflow reports its own failures — ✅ COMPLETE (committed cf8524e, 2026-11-11)

## As-built (2026-11-11)

Committed `cf8524e`. Simplified during review: the alert is one email — the
GitHub-issue machinery (create / comment / close / search, `issues: write`,
the recovery step, the `job.status` branch) was dropped before the commit
(owner decision 2026-11-11). Final file: 5 steps, 84 lines.

Proven in production: dispatch `43102126654` with `force_fail=true` → red run,
`Email on failure` step green, email received at `info@kaidev.io` with the run
URL and the forced report line.

Not provable yet: the silent-green half. `if: failure()` makes silence
structural, but no green run has happened since the commit — see below.

### Found by the first alert

Every scheduled run since **2026-11-09 18:19 UTC** is red (9 consecutive), so
`public/data` has been frozen at `e70dde0` (2026-11-09 12:26) for two days:

```
ERROR: provider: thinkingmachines/inkling-2-small:free: Thinking Machines:
prompt price not > 0: '0'
```

`update.py:896-901` dies when any provider endpoint reports a prompt price
`<= 0`; Thinking Machines now serves a genuinely free endpoint, so a real
value trips a check written for anomalies. Out of this step's scope — the
fix is the next task.

## Spec

`.github/workflows/update-data.yml` only. The alert is **one email**: no
GitHub issue, no state store, no recovery message. Owner decision 2026-11-11,
superseding settled decision #7 — that decision picked an issue because it
needed zero secrets; with MailerSend in place the rationale is gone and the
issue machinery (create / comment / close / search, `issues: write`) was ~90
of the file's 135 lines.

1. **Permissions.** `contents: write` only — `issues: write` is dropped.

2. **Dispatch input** (the only way to prove an alert without breaking data):

   ```yaml
   on:
     schedule:
       - cron: "15 */6 * * *"
     workflow_dispatch:
       inputs:
         force_fail:
           description: "Abort before fetching, to prove the failure alert"
           type: boolean
           default: false
   ```

   First lines of the `Run update.py` step's `run:` block:

   ```sh
   if [ "${{ inputs.force_fail }}" = "true" ]; then
     echo "force_fail: aborting on purpose (alert path test)"
     mkdir -p .tmp
     printf 'force_fail: aborted on purpose (alert path test)\n' > .tmp/update-report.txt
     exit 1
   fi
   ```

   The report line is deliberate: without it the forced run's email would say
   `(no report captured)` and the verification below could not prove the
   excerpt path.

3. **Email on failure** — last step in the job, after `Commit + push if data
   changed`, so it also covers a failing commit/push:

   - `if: failure()`, `env: MAILERSEND_TOKEN: ${{ secrets.MAILERSEND_TOKEN }}`.
   - Body: one line with the UTC stamp, the run URL, then the last 60 lines of
     `.tmp/update-report.txt` (or `(no report captured)`).
   - `POST https://api.mailersend.com/v1/email`, from `alerts@kaidev.io` to
     `info@kaidev.io`, payload built by `jq -n --arg` and piped straight into
     `curl --data @-`, so the token only ever appears in the `Authorization`
     header — never in script text, a URL, or a log line.
   - `|| echo "email failed (run is already red)"`: a revoked token must not
     turn one red run into two, and the data path is what matters.

4. **No recovery notification.** A green run stays silent; the absence of
   further emails is the all-clear. Anything else needs state (an issue or a
   run-history probe) — decided against 2026-11-11.

5. Header comment in the file: one line saying a failed run emails the owner
   and a green one says nothing.

## Why MailerSend

`kaidev.io` is already a verified MailerSend sending domain (DKIM
`mlsend2._domainkey`, return-path `mta`, SPF include), so this adds no DNS
record and no vendor. Cloudflare Email Sending was rejected because its
onboarding manages `_dmarc.kaidev.io`, where a working `p=quarantine` policy
already exists.

## Not touched in this step

The cron schedule, the commit gate, `update.py`, any `public/data` behaviour,
DNS (`_dmarc.kaidev.io` / SPF / MX stay as they are), repo variables.

## Verification

Static, before any push:

```sh
npx --yes js-yaml .github/workflows/update-data.yml > /dev/null && echo yaml-ok
gh workflow view update-data.yml --yaml | sed -n '1,40p'
```

End to end, after the owner pushes (the workflow only dispatches from the
default branch):

```sh
gh workflow run update-data.yml -f force_fail=true   # expect a red run + one email
gh workflow run update-data.yml -f force_fail=true   # second red run, second email
gh workflow run update-data.yml                      # green run, no email
```

Passing: each red run produces one email to `info@kaidev.io` carrying the run
URL and the report tail — verified by eye, since the runner's response body is
only MailerSend's `202 {"message_id": …}`; the green run produces none. The
green dispatch is a real update, so it may commit a `data: scheduled refresh`
if the data moved.

## Seams under test

None — a workflow file. The verification above is the test, and it is run for
real after the push.
