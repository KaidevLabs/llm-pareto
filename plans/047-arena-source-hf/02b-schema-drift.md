# Step 02b — Notice upstream schema drift — OPEN

> Runs before `03-close.md`, and **after** `04-provider-stats.md`: the
> fingerprint's baseline can only be established by a run that reaches the
> write step, which step 04 restores.

## Why

On 2026-10-13 OpenRouter added `throughput_window_minutes` to the model page's
`endpointStats` block (30 min on 723 endpoints, 1440 on 137). Nothing in the
pipeline could have told us: the parsers read a whitelist, so an added field
is invisible, and the 11-day Arena outage hid the whole provider layer behind
a different failure anyway. Field *removals* are mostly covered by accident
(the required-field checks, the stats-coverage floor, the join hit rate), but
*additions* — the shape of every upstream payload — are never looked at.

This step makes the shape an observable: each run fingerprints the field set
of every upstream surface it parses, diffs it against the previous run's
fingerprint (kept in the committed `meta.json`), prints the delta in the
report, and — in the workflow — opens/comments on an issue when it changed.

## Design rules

- The fingerprint lives in `meta.json` (`"schema"`), so no new file, no new
  state store, and the baseline travels with the data commit.
- **Never fatal.** A fingerprint that dies would freeze the pipeline on a
  benign additive field and leave no way to accept the new shape except
  hand-editing `meta.json`. Fatality stays where a field is actually consumed:
  `parse_arena_rows`'s required fields, the stats-coverage floor, the join hit
  rate, the percentile tripwire.
- The delta is *loud* through the workflow issue, not through the exit code,
  so data keeps flowing.
- Known, accepted behaviour: `meta.json` is not in the commit gate (memory
  #441), so a run whose upstream shape changed but whose gated data files did
  not gets no commit — the fingerprint baseline stays put, the same delta is
  reported again next run, and it is noticed the first time a gated file
  changes. The workflow step exits silently when nothing was committed.

## Spec — `update.py`

Insert a section immediately **before** `def write_json(path, obj):`:

```python
# ------------------------------------------- upstream schema fingerprint (02b)

META_PATH = OUT_DIR / "meta.json"

# every upstream payload shape the pipeline parses; the fingerprint of each
# one is committed in meta.json under "schema" (plan 047 step 02b)
SCHEMA_SECTIONS = (
    "arena_rows",           # HF datasets-server row dicts
    "openrouter_models",    # /api/v1/models model objects
    "endpoints_api",        # /api/v1/models/{id}/endpoints endpoint objects
    "model_page_endpoint",  # model-page RSC endpoint objects
    "model_page_stats",     # their nested endpointStats blocks
)


def schema_signature(objs):
    """Sorted field names observed across a payload's objects (union).
    Non-dict entries are ignored; the union means a field carried by one
    model in a thousand still shows up."""
    fields = set()
    for obj in objs:
        if isinstance(obj, dict):
            fields.update(obj)
    return sorted(fields)


def schema_diff(prev, cur):
    """(added, removed) field names, sorted."""
    return sorted(set(cur) - set(prev)), sorted(set(prev) - set(cur))


def check_schema(sections, prev_path=META_PATH):
    """Diff this run's field fingerprints against the previous meta.json's
    "schema" block and report the delta (plan 047 step 02b). Never dies on a
    delta — see the step doc; a corrupt previous meta.json is a hard error
    like any other repo-state error. Returns (report lines, block to commit)."""
    prev = {}
    if prev_path.exists():
        try:
            prev = json.loads(prev_path.read_text()).get("schema") or {}
        except Exception as e:
            die(f"schema: previous meta.json unreadable: {e}")
    block = {}
    lines = []
    for name in SCHEMA_SECTIONS:
        cur = sorted(sections.get(name) or [])
        block[name] = cur
        before = sorted(prev.get(name) or [])
        if not before:
            lines.append(f"  schema: {name}: {len(cur)} fields (baseline)")
            continue
        added, removed = schema_diff(before, cur)
        if added or removed:
            delta = " ".join(
                part
                for part in (
                    ("+" + " ".join(added)) if added else "",
                    ("-" + " ".join(removed)) if removed else "",
                )
                if part
            )
            lines.append(f"  schema: {name}: {delta}")
        else:
            lines.append(f"  schema: {name}: {len(cur)} fields (unchanged)")
    return lines, block
```

Wire it up:

1. **`parse_openrouter(raw)`** — return the upstream model objects alongside
   the normalized models: change `    return out` at the end of the function to
   `    return out, models` and add one docstring line (`Returns (normalized
   models, the upstream model objects for the schema fingerprint).`). Its only
   caller is `main()`.

2. **`build_provider_layer`** collects the provider-side fingerprints while it
   already parses each payload. In the per-model loop, before/around
   `entries, unjoined, n_joined = join_provider_layers(merged, page_eps)`, add:

   ```python
        api_objs.extend(api_eps)
        page_objs.extend(page_eps)
        stat_objs.extend(
            p["stats"] for p in page_eps if isinstance(p.get("stats"), dict)
        )
   ```

   with `api_objs, page_objs, stat_objs = [], [], []` initialised next to
   `provider_counts = {}`; and before the final `return layer, rep`:

   ```python
    rep["schema"] = {
        "endpoints_api": schema_signature(api_objs),
        "model_page_endpoint": schema_signature(page_objs),
        "model_page_stats": schema_signature(stat_objs),
    }
   ```

   (The `rep` dict literal gets `"schema": {}` as an initial key, next to
   `"models_detail": []`, so the shape is uniform.)

3. **`main()`** — the Arena side already holds the rows, the catalog side the
   raw objects:

   ```python
    arena_rows = fetch_arena_rows()
    arena_entries = parse_arena_rows(arena_rows, org_names)
   ```

   ```python
    raw_or = fetch(OPENROUTER_URL)
    or_models, or_raw_models = parse_openrouter(raw_or)
   ```

   after `validate_provider_layer(...)` (and before the logos block, so the
   previous `meta.json` is still the old one):

   ```python
    schema_lines, schema_block = check_schema(
        {
            "arena_rows": schema_signature(arena_rows),
            "openrouter_models": schema_signature(or_raw_models),
            **provider_rep["schema"],
        }
    )
   ```

   `meta` gains `"schema": schema_block,` (last key, after `"provider"`), and
   `write_json(META_PATH, meta)` replaces `write_json(OUT_DIR / "meta.json",
   meta)` in the write loop (`META_PATH` is the same path).

   The report gains a section after `provider report`:

   ```python
    print("schema report")
    for line in schema_lines:
        print(line)
   ```

## Spec — workflow

`.github/workflows/update-data.yml`, a new step **after** `Commit + push if
data changed`:

```yaml
      - name: Notice upstream schema drift
        if: success()
        run: |
          git show HEAD~1:public/data/meta.json > .tmp/prev-meta.json 2>/dev/null \
            || echo '{}' > .tmp/prev-meta.json
          python3 - <<'PY' > .tmp/schema-drift.md
          import json

          def schema(path):
              try:
                  return json.load(open(path)).get("schema") or {}
              except Exception:
                  return {}

          prev = schema(".tmp/prev-meta.json")
          cur = schema("public/data/meta.json")
          for name in sorted(cur):
              before = set(prev.get(name) or [])
              after = set(cur[name] or [])
              if before and before != after:
                  print(f"- `{name}`: +{sorted(after - before)} -{sorted(before - after)}")
          PY
          if [ ! -s .tmp/schema-drift.md ]; then
            echo "no schema drift"
            exit 0
          fi
          {
            echo "An upstream payload changed its field set since the previous data commit."
            echo
            cat .tmp/schema-drift.md
            echo
            echo "- run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            echo "- at: $(date -u +%FT%TZ)"
          } > .tmp/schema-issue.md
          TITLE="data: upstream schema drift"
          nums=$(gh issue list --state open --search "\"$TITLE\" in:title" \
            --json number --jq '.[].number')
          if [ -z "$nums" ]; then
            gh issue create --title "$TITLE" --body-file .tmp/schema-issue.md
          else
            for n in $nums; do gh issue comment "$n" --body-file .tmp/schema-issue.md; done
          fi
```

Precondition: step 02 has already added `issues: write` to `permissions` and
`GH_TOKEN` to the job env — verify both are present; if they are not, stop and
report (do not duplicate step 02's work).

Add one line to the file's header comment: a green run that changed an upstream
payload's field set opens/comments on `data: upstream schema drift`.

## Tests — new `tests/test_schema.py`

Module docstring: `"""Characterization tests for the upstream schema
fingerprint (plan 047 step 02b)."""` Same style as the rest of `tests/`
(`unittest`, one behavior per test, synthetic dicts). Classes:

- `TestSchemaSignature`
  - `test_unions_fields_across_objects` — `[{"a": 1, "b": 2}, {"b": 2, "c": 3}]`
    → `["a", "b", "c"]`.
  - `test_ignores_non_objects` — `[{"a": None}, "x", None]` → `["a"]`.
  - `test_empty_payload_is_empty` — `[]` → `[]`.
- `TestSchemaDiff`
  - added only, removed only, both (one assertion each, sorted lists).
- `TestCheckSchema`, using `tempfile.TemporaryDirectory()` and a `prev.json`
  written by the test (never `public/data/meta.json`):
  - `test_first_run_reports_baseline` — no prev file → every section line ends
    `(baseline)`, returned block equals `{name: [...]}` for all five
    `SCHEMA_SECTIONS`, no exit.
  - `test_unchanged_reports_field_count` — prev equals current →
    `"arena_rows: 2 fields (unchanged)"`.
  - `test_added_field_is_reported_not_fatal` — delta line contains
    `+throughput_window_minutes`; does not raise.
  - `test_removed_field_is_reported_not_fatal` — delta line contains
    `-p99_throughput`; does not raise.
  - `test_corrupt_previous_meta_dies` — prev file holds `"not json"` →
    `SystemExit` (capture stderr with `redirect_stderr(io.StringIO())`).

## Not touched in this step

Parser semantics and every threshold, `logging`/exit behaviour of the update
run, the commit gate, the alert/recovery steps from step 02, the front end,
`public/data/*` contents.

## Verification

```sh
python3 -c "import yaml;yaml.safe_load(open('.github/workflows/update-data.yml'))" && echo yaml-ok
python3 -m unittest discover -s tests -v      # green, incl. test_schema
python3 update.py                             # exit 0
```

Passing `update.py` ends with a `schema report` section of five
`(baseline)` lines on the first run after this step, and five
`(unchanged)` lines on the run after that. Then:

```sh
python3 -c "import json;print(json.dumps(json.load(open('public/data/meta.json'))['schema'],indent=1))"
```

- five sections: `arena_rows` (11 fields today), `openrouter_models`,
  `endpoints_api`, `model_page_endpoint`, `model_page_stats` (the stats block
  carries `throughput_window_minutes` after step 04).

Drift path, locally provable without touching upstream: copy `meta.json`,
delete one field name from one section, and re-run `check_schema` against the
edited copy —

```sh
python3 - <<'PY'
import json, shutil, tempfile, pathlib, update
src = pathlib.Path("public/data/meta.json")
d = tempfile.mkdtemp()
prev = pathlib.Path(d) / "meta.json"
meta = json.loads(src.read_text())
meta["schema"]["model_page_stats"] = [f for f in meta["schema"]["model_page_stats"] if f != "p50_throughput"]
prev.write_text(json.dumps(meta))
lines, _ = update.check_schema(
    {k: json.loads(src.read_text())["schema"][k] for k in update.SCHEMA_SECTIONS},
    prev_path=prev,
)
print("\n".join(lines))
PY
```

Expect a `model_page_stats: ... -p50_throughput` line and a zero exit.

## Seams under test

`schema_signature`, `schema_diff`, `check_schema` — pure functions in
`update.py`.
