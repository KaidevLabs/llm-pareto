# Step 03 — Consumer filtering recipe — OPEN

## Spec

Docs only:

1. README section (new "Provider data / routing recipe") or `docs/provider-routing.md` + pointer: the `zdr` field in `endpoints.json` (schema: one record per endpoint; the keys the recipe uses), the raw URLs (`/data/endpoints.json`), freshness (6 h), and the canonical recipe to build an OpenCode whitelist:
   - filter `zdr === true`, accepted `quantization`, `status === 0`;
   - sort by price (in+out);
   - `order` = tags; `quantizations` = accepted list; `allow_fallbacks: false`;
   - example resulting block.
2. Note the `retainsPrompts` vs `zdr` discrepancy (why the flag exists).

## Not touched in this step

- Code, data, front end.

## Verification

- `curl -s https://llm-pareto.kaidev.io/data/endpoints.json | python3 -m json.tool | head` — the cited URL exists (post-deploy).
- The recipe reproduces a valid block for the owner's 3 models (one-off check, no committed output).

## Seams under test

- no tests: docs-only step.
