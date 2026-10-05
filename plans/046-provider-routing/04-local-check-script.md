# Step 04 — Local `.sh`: check + propose the OpenRouter block — OPEN

## Spec

Artifact outside the repo: `~/.config/opencode/openrouter-routing.sh` (name settles at review):

1. **Check**: fetch the raw (`https://llm-pareto.kaidev.io/data/endpoints.json`; `--data <path|url>` override), policy as script constants (models: glm-5.3-flash / deepseek-v4.1-flash / kimi-k3; quant: fp8; ZDR-only; sort by in+out price; `allow_fallbacks: false`; `limit.output: 32768`), compare against the `providers.openrouter` block of `~/.config/opencode/opencode.jsonc` (`--config <path>` override) and print the diff (or "no drift").
2. **Apply**: `--apply` writes only the openrouter block, preserving the rest of the file, with an `opencode.jsonc.bak-<timestamp>` backup; without `--apply` it never writes.
3. Implementation: `.sh` using `python3` for JSON (available); no new dependencies.

## Not touched in this step

- Nothing in the repo (the artifact lives in `~/.config/opencode/`); no repo code to commit — the close is the plan commit only.

## Verification

- `--config` on a fixture copy of the config + `--data public/data/endpoints.json` (local, pre-deploy): no drift against the current block (or the expected diff); simulate drift (edit the copy) → diff printed; `--apply` → backup + valid written block (`python3 -m json.tool`).
- Live (post-deploy, owner push): run against the published URL → no drift.
- Never touch the owner's real config during verification (fixture only); the first live run is the owner's.

## Seams under test

- no tests: script lives outside the repo (bash + embedded python3); verification is fixture + documented live run in the as-built.
