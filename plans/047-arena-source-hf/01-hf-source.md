# Step 01 — Arena text board from the HF dataset — OPEN

## Spec

`update.py`:

1. **Constants.** Replace `ARENA_URL` with:

   ```python
   HF_DATASET = "lmarena-ai/leaderboard-dataset"
   HF_BOARD_URL = "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset"
   HF_ROWS_URL = "https://datasets-server.huggingface.co/rows"
   HF_CONFIG, HF_SPLIT = "text", "latest"
   HF_PAGE, HF_MAX_PAGES = 100, 10
   ```

   Keep `USER_AGENT`, `TIMEOUT`, `FETCH_ATTEMPTS`, `_is_transient`, `fetch()`.
   Keep `RSC_RE`, `_decode_chunk`, `_extract_json_array` — `parse_provider_page`
   still needs them. Delete only `parse_arena`.

2. **`arena_name(model_name)` → str.** HF mixes display names and slugs:

   - a string with no uppercase letter and no space is returned unchanged
     (`claude-3.5-haiku-20241022`, `amazon-nova-2-lite`);
   - otherwise lowercase it, turn a trailing `" (<inner>)"` into
     `"-" + inner.lower().replace(", ", "-").replace(" ", "-")`, then replace
     remaining spaces with `-`.

   Pinned cases: `Gemini 4 Argon (High)` → `gemini-4-argon-high`;
   `Claude Fable 5.1 (Max)` → `claude-fable-5.1-max`;
   `Gemini 3.1 Pro Preview` → `gemini-3.1-pro-preview`;
   `Claude Opus 4 (Non-Thinking, 09-2025)` → `claude-opus-4-non-thinking-09-2025`;
   `amazon-nova-2-lite` → `amazon-nova-2-lite`.

3. **`parse_arena_rows(rows, org_names)` → list of entry dicts.** Same keys
   `join()` reads today:

   | entry key | from row |
   |---|---|
   | `modelDisplayName` | `arena_name(row["model_name"])` |
   | `rank` / `rankUpper` / `rankLower` | `int(rank)` (same value three ways — HF carries one rank) |
   | `rating` / `ratingUpper` / `ratingLower` | `rating`, `rating_upper`, `rating_lower` |
   | `votes` | `int(vote_count)` |
   | `modelOrganization` | `resolve_org(row["organization"], org_names)` |
   | `license` | `license` |
   | `modelUrl`, `contextLength`, `inputPricePerMillion`, `outputPricePerMillion` | `None` |
   | `publishDate` | `leaderboard_publish_date` |

   Die when a required field (`rank`, `model_name`, `rating`, `vote_count`) is
   `None`/missing — the schema-drift signal replaces the old RSC-anchor check.
   Skip nothing silently: a row that cannot be mapped is a `die`.

4. **`resolve_org(slug, org_names)` → str.** `org_names` is
   `{org_key(display): display}` built from the logo registry keys. `org_key(s)`
   = lowercase, drop every character that is not `a–z0–9`. Known slug →
   display (`google` → `Google`, `zai` → `Z.ai`, `inception-ai` →
   `Inception AI`); unknown or empty → the slug verbatim. `org_key` must be a
   module-level helper (the front-end analogue is `src/lib/family.ts`, which
   this step does **not** touch).

5. **`fetch_arena_rows(fetcher=fetch)` → list of rows.** GET
   `{HF_ROWS_URL}?dataset=…&config=text&split=latest&offset=N&length=100`
   (URL-encode `lmarena-ai/leaderboard-dataset`), `json.loads` the body, take
   `payload["rows"]` → `[r["row"] for r in …]`. Rules:

   - first page must exist and its first row must have `category == "overall"`
     — otherwise `die` (category ordering changed);
   - accumulate while `category == "overall"`; stop as soon as a page holds a
     non-`overall` row or returns fewer than `HF_PAGE` rows;
   - exhausting `HF_MAX_PAGES` without reaching the stop condition is a `die`
     (the board outgrew the cap — raise it deliberately, never silently).

6. **`main()`.** `print(f"fetching {HF_BOARD_URL}")`;
   `arena_entries = parse_arena_rows(fetch_arena_rows(), org_names)` where
   `org_names` comes from `load_logos(LOGOS_PATH)` (already loaded later in
   `main` — load it before the join, reuse the same manifest object so nothing
   is read twice). `meta["sources"]["arena"]` becomes
   `{"url": HF_BOARD_URL, "dataset": HF_DATASET, "config": "text", "split": "latest", "entries": N, "publish_date": <max publishDate>, "ratings_as_of": <same>}`.
   `join()` takes `modelOrganization` as given (resolved in step 3), so it needs
   no change beyond nothing: verify `arena_org` prints as `Google`, not `google`.

Tests (`tests/`):

- new `tests/test_arena_hf.py`: one `TestCase` per function — `arena_name`
  (the five pinned cases above, one assertion each), `resolve_org`
  (known/unknown/empty), `parse_arena_rows` (full mapping of one synthetic
  row + `die` on a missing `rating`), `fetch_arena_rows` (fake fetcher: two
  pages, second holds a `chinese` row → 3 entries and exactly 2 calls; first
  page not `overall` → `SystemExit`; `HF_MAX_PAGES` exhausted → `SystemExit`).
  Fixtures are synthetic dicts, never recorded payloads.
- delete `tests/test_parse_arena.py` (`parse_arena` is gone).
- `tests/test_validate.py` and `tests/test_match_join.py`: adjust only if they
  construct arena entries through `parse_arena`.

Docs: `AGENTS.md` and `README.md` — replace any sentence naming the
`arena.ai`/`lmarena.ai` leaderboard page as the source with the HF dataset
(`grep -rn "lmarena\|arena.ai" AGENTS.md README.md`).

## Not touched in this step

`fetch()`, `normalize()`, `match_arena()`, `join()`'s matching logic,
`validate()` thresholds, the provider layer, logos sync, history,
`public/data/*` contents (they change by running, not by editing), the front
end, the workflow.

## Verification

```sh
python3 -m unittest discover -s tests -v          # green, incl. test_arena_hf
python3 update.py                                  # exit 0
```

Passing `update.py` output: `arena: ~418 entries`, `join: ~215 models matched
(...), ~200 arena unmatched`, top-20 ≥ 18/20, and the run reaches the write
step. Then review the `public/data` diff — `meta.json` first:
`sources.arena.publish_date` present, `join.combined` in the same range as the
Oct-13 snapshot (158) plus new models, `logos` map unchanged in size, and no
`arena_org` value in `combined.json` rendered as a lowercase slug for an org
that already had a logo key (`Google`, `Anthropic`, `OpenAI`, …).

## Seams under test

`arena_name`, `resolve_org`, `parse_arena_rows`, `fetch_arena_rows` (paging
stop rule) — pure functions in `update.py`, exercised by
`tests/test_arena_hf.py`.
