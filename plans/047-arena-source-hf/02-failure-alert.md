# Step 02 — The workflow reports its own failures — OPEN

## Spec

`.github/workflows/update-data.yml` only.

1. **Permissions.** `permissions: contents: write` gains `issues: write`.

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
     exit 1
   fi
   ```

3. **Alert step — last in the job**, after `Commit + push if data changed`, so
   it also covers a failing commit/push:

   ```yaml
   - name: Alert on failure
     if: failure()
     env:
       GH_TOKEN: ${{ github.token }}
     run: |
       TITLE="data: update.py failing"
       body=$(mktemp)
       {
         echo "The data update failed."
         echo
         echo "- run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
         echo "- at: $(date -u +%FT%TZ)"
         echo
         echo '```'
         tail -n 60 .tmp/update-report.txt 2>/dev/null || echo "(no report captured)"
         echo '```'
       } > "$body"
       nums=$(gh issue list --state open --search "\"$TITLE\" in:title" \
         --json number --jq '.[].number')
       if [ -z "$nums" ]; then
         gh issue create --title "$TITLE" --body-file "$body"
       else
         for n in $nums; do gh issue comment "$n" --body-file "$body"; done
       fi
   ```

   One open issue at most: an existing alert is commented, never duplicated.

4. **Recovery step** — after the alert step, `if: success()`: for every open
   issue titled `data: update.py failing`, comment
   `Recovered: <run url> — <UTC stamp>` and close it.

5. Header comment in the file: one line saying a red run opens an issue and
   the next green run closes it, so the alerting is discoverable from the
   workflow itself.

## Not touched in this step

The cron schedule, the commit gate, the `gh` token plumbing, `update.py`, any
`public/data` behaviour.

## Optional, needs an owner input

`ntfy.sh` push (a second `curl` line in the alert step). Blocked: the topic
name is the owner's to choose. Do not invent one.

## Verification

Static, before any push:

```sh
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/update-data.yml'))" \
  && echo yaml-ok
gh workflow view update-data.yml --yaml | sed -n '1,40p'
```

End to end, after the owner pushes (the workflow only dispatches from the
default branch):

```sh
gh workflow run update-data.yml -f force_fail=true     # expect a red run
gh issue list --search '"data: update.py failing" in:title'   # exactly one, open, with report tail + run link
gh workflow run update-data.yml                         # expect a green run
gh issue list --state open --search '"data: update.py failing" in:title'  # empty: closed with a "Recovered" comment
```

Passing: the red run creates exactly one issue carrying the tail of
`.tmp/update-report.txt` and the run URL; a second red run comments on the
same issue instead of opening another; the green run closes it.

## Seams under test

None — a workflow file. The verification above is the test, and it is run for
real after the push.
