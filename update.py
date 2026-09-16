#!/usr/bin/env python3
"""llm-arena-pareto data updater.

Fetches the LMArena text leaderboard and the OpenRouter model catalog,
normalizes both, joins them on model name, validates the result, and
writes the datasets consumed by the static site into public/data/.

Zero dependencies (Python 3 stdlib only). Run:  python3 update.py
Exits non-zero on any anomaly — always read the printed match report.
See plans/001-arena-pareto.md for the design and settled decisions.
"""

import difflib
import json
import os
import re
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ARENA_URL = "https://lmarena.ai/leaderboard/text"
OPENROUTER_URL = "https://openrouter.ai/api/v1/models"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) llm-arena-pareto-updater/1.0"
TIMEOUT = 60

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "public" / "data"
OVERRIDES_PATH = ROOT / "overrides.json"

# validation thresholds (plan open branch 3: proposed from measured numbers)
ARENA_COUNT_MIN, ARENA_COUNT_MAX = 50, 2000
OR_COUNT_MIN, OR_COUNT_MAX = 100, 5000
TOP20_MATCH_MIN = 18          # at least 18 of the top-20 arena models must match
OVERALL_MATCH_MIN = 0.40      # overall arena match rate
ARENA_FIELD_MISSING_MAX = 0.05
OR_PRICING_PRESENT_MIN = 0.90
FUZZY_AUTO_RATIO = 0.95       # difflib ratio for an automatic fuzzy match

ARENA_REQUIRED_FIELDS = ("rank", "modelDisplayName", "rating", "votes")
RSC_RE = re.compile(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>', re.S)


def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def fetch(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        die(f"fetch failed: {url}: {e}")


# ---------------------------------------------------------------- arena

def _decode_chunk(raw):
    try:
        return json.loads(f'"{raw}"')
    except Exception:
        return raw.encode("utf-8").decode("unicode_escape", errors="replace")


def _extract_json_array(text, key):
    i = text.find(key)
    if i < 0:
        die(f"arena: anchor {key!r} not found in page payload (page format changed?)")
    start = text.find("[", i)
    if start < 0:
        die(f"arena: no array after {key!r} (page format changed?)")
    depth, in_str, esc = 0, False, False
    for j in range(start, len(text)):
        c = text[j]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : j + 1])
                    except Exception as e:
                        die(f"arena: failed to parse entries array: {e}")
    die("arena: unterminated entries array (page format changed?)")


def parse_arena(html):
    chunks = RSC_RE.findall(html)
    if not chunks:
        die("arena: no RSC chunks found in HTML (page format changed?)")
    text = "".join(_decode_chunk(c) for c in chunks)
    entries = _extract_json_array(text, '"entries":')
    if not isinstance(entries, list) or not entries:
        die("arena: entries array is empty")
    for e in entries:
        if not isinstance(e, dict):
            die(f"arena: non-object entry in entries: {e!r}")
    return entries


# ------------------------------------------------------- openrouter

def parse_openrouter(raw):
    try:
        data = json.loads(raw)
    except Exception as e:
        die(f"openrouter: bad JSON: {e}")
    models = data.get("data")
    if not isinstance(models, list) or not models:
        die("openrouter: no models in response")
    out = []
    for m in models:
        mid = m.get("id") or ""
        if mid.startswith("~") or mid.endswith(":batch"):
            continue  # alias / billing variant, not a model we price
        arch = m.get("architecture") or {}
        pricing = m.get("pricing") or {}
        inp = arch.get("input_modalities") or []

        def per_m(v):
            try:
                return round(float(v) * 1_000_000, 6)
            except (TypeError, ValueError):
                return None

        out.append(
            {
                "id": mid,
                "name": m.get("name") or mid,
                "org": mid.split("/")[0],
                "price_in_per_m": per_m(pricing.get("prompt")),
                "price_out_per_m": per_m(pricing.get("completion")),
                "vision": "image" in inp,
                "context_length": m.get("context_length"),
            }
        )
    return out


# ---------------------------------------------------------------- join

# config suffixes actually observed on arena names: -high, -xhigh, -max
# (thinking-level configs of the same base model). -medium/-low are NOT
# stripped: they occur inside real model names (mistral-medium,
# gemini-3.5-flash-medium) and the prefix rules below handle them.
_STRIP_ORDER = [
    re.compile(r"-latest-\d{8}$"),
    re.compile(r"-\d{8}$"),
    re.compile(r"-\d{4,}$"),
    re.compile(r"-\d{2}-\d{2}-\d{2}$"),
    re.compile(r"-\d{2}-\d{2}$"),
    re.compile(r"-beta\d*$"),
    re.compile(r"-preview$"),
    re.compile(r"-exp$"),
    re.compile(r"-(high|xhigh|max)$"),
]


def normalize(name):
    s = name.lower().strip()
    s = re.sub(r"\s*\(.*?\)", "", s)
    s = s.replace(" ", "")
    s = s.replace(".", "-")
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r":(batch|free)$", "", s)
        for rx in _STRIP_ORDER:
            s = rx.sub("", s)
        s = s.strip("-")
    return s


def load_overrides():
    if not OVERRIDES_PATH.exists():
        return {}
    try:
        ov = json.loads(OVERRIDES_PATH.read_text())
    except Exception as e:
        die(f"overrides.json: bad JSON: {e}")
    if not isinstance(ov, dict):
        die("overrides.json: expected {arena_name: \"org/model\"}")
    return {normalize(k): v for k, v in ov.items()}


def build_or_lookup(or_models):
    lookup = {}
    collisions = []
    for m in or_models:
        key = normalize(m["id"].split("/")[-1])
        if key in lookup:
            collisions.append(
                f"{key}: {lookup[key]} vs {m['id']}"
            )
            keep = lookup[key].split("/")[-1]
            if len(m["id"].split("/")[-1]) < len(keep):
                lookup[key] = m["id"]
        else:
            lookup[key] = m["id"]
    return lookup, collisions


def match_arena(name, lookup, keys, overrides):
    """Return (or_id_or_None, method_or_None, detail).

    detail is the difflib ratio for fuzzy matches, or a candidate list when
    the name stays unmatched (reported so a human can add an override).
    """
    n = normalize(name)
    if n in overrides:
        return overrides[n], "override", None
    if n in lookup:
        return lookup[n], "exact", None
    # base: an OR model is a prefix of the arena name (arena ran a variant of
    # it, e.g. gpt-5.5-instant -> gpt-5.5). Longest base = most specific.
    base = [k for k in keys if k != n and n.startswith(k)]
    if base:
        return lookup[max(base, key=len)], "prefix-base", None
    # variant: the arena name is a prefix of OR models (arena used the base
    # name, OR lists specific builds, e.g. gemma-4-31b -> gemma-4-31b-it).
    # Only join when unambiguous; otherwise report.
    variant = [k for k in keys if k != n and k.startswith(n)]
    if len(variant) == 1:
        return lookup[variant[0]], "prefix-variant", None
    fuzzy = difflib.get_close_matches(n, sorted(keys), n=3, cutoff=0.8)
    if fuzzy:
        ratio = difflib.SequenceMatcher(None, n, fuzzy[0]).ratio()
        if ratio >= FUZZY_AUTO_RATIO:
            return lookup[fuzzy[0]], "fuzzy", round(ratio, 2)
        return None, None, fuzzy
    if variant:
        return None, None, sorted(variant)
    return None, None, []


def join(arena_entries, or_models, overrides):
    lookup, collisions = build_or_lookup(or_models)
    keys = set(lookup)
    by_or = {}
    unmatched = []
    method_counts = {}
    applied_overrides = []

    for e in arena_entries:
        name = e.get("modelDisplayName") or ""
        matched_id, method, detail = match_arena(name, lookup, keys, overrides)
        if matched_id is None:
            cands = detail if isinstance(detail, list) else []
            unmatched.append(
                {
                    "name": name,
                    "rank": e.get("rank"),
                    "candidates": [lookup[c] for c in cands],
                }
            )
            continue
        method_counts[method] = method_counts.get(method, 0) + 1
        if method == "override":
            applied_overrides.append(
                {"arena": name, "openrouter_id": matched_id}
            )
        entry = by_or.setdefault(
            matched_id,
            {
                "openrouter_id": matched_id,
                "arena_entries": [],
                "match_method": method,
                "match_ratio": detail,
            },
        )
        entry["arena_entries"].append(e)

    combined = []
    variants_collapsed = 0
    for mid, rec in by_or.items():
        entries = rec["arena_entries"]
        best = max(entries, key=lambda e: e.get("rating") or 0)
        if len(entries) > 1:
            variants_collapsed += 1
        m = next(x for x in or_models if x["id"] == mid)
        combined.append(
            {
                "or_id": mid,
                "or_name": m["name"],
                "price_in_per_m": m["price_in_per_m"],
                "price_out_per_m": m["price_out_per_m"],
                "vision": m["vision"],
                "context_length": m["context_length"],
                "arena_rank": best.get("rank"),
                "arena_elo": best.get("rating"),
                "arena_elo_upper": best.get("ratingUpper"),
                "arena_elo_lower": best.get("ratingLower"),
                "arena_votes": best.get("votes"),
                "arena_org": best.get("modelOrganization") or m["org"],
                "arena_license": best.get("license"),
                "arena_model": best.get("modelDisplayName"),
                "arena_variants": sorted(
                    x.get("modelDisplayName") for x in entries
                ),
                "arena_context_length": best.get("contextLength"),
                "match_method": rec["match_method"],
                "match_ratio": rec["match_ratio"],
            }
        )
    combined.sort(key=lambda c: (c["arena_rank"] is None, c["arena_rank"]))
    return (
        combined,
        unmatched,
        collisions,
        method_counts,
        variants_collapsed,
        applied_overrides,
    )


# ---------------------------------------------------------- validation

def validate(arena_entries, or_models, combined, unmatched):
    n_arena = len(arena_entries)
    if not (ARENA_COUNT_MIN <= n_arena <= ARENA_COUNT_MAX):
        die(f"arena: {n_arena} entries, expected {ARENA_COUNT_MIN}-{ARENA_COUNT_MAX}")
    n_or = len(or_models)
    if not (OR_COUNT_MIN <= n_or <= OR_COUNT_MAX):
        die(f"openrouter: {n_or} models, expected {OR_COUNT_MIN}-{OR_COUNT_MAX}")

    missing = sum(
        1
        for e in arena_entries
        if any(e.get(f) is None for f in ARENA_REQUIRED_FIELDS)
    )
    if missing / n_arena > ARENA_FIELD_MISSING_MAX:
        die(f"arena: {missing}/{n_arena} entries missing required fields")

    priced = sum(
        1
        for m in or_models
        if m["price_in_per_m"] is not None and m["price_out_per_m"] is not None
    )
    if priced / n_or < OR_PRICING_PRESENT_MIN:
        die(f"openrouter: only {priced}/{n_or} models have pricing")

    top20 = [e for e in arena_entries if isinstance(e.get("rank"), int) and e["rank"] <= 20]
    top20_unmatched = {u["name"] for u in unmatched} & {
        e.get("modelDisplayName") for e in top20
    }
    top20_matched = len(top20) - len(top20_unmatched)
    if top20_matched < TOP20_MATCH_MIN:
        die(f"join: only {top20_matched}/20 top arena models matched (need {TOP20_MATCH_MIN})")

    matched = n_arena - len(unmatched)
    if matched / n_arena < OVERALL_MATCH_MIN:
        die(
            f"join: overall match rate {matched}/{n_arena} "
            f"({100 * matched / n_arena:.0f}%) below {OVERALL_MATCH_MIN:.0%}"
        )
    if not combined:
        die("join: combined dataset is empty")


# ---------------------------------------------------------------- main

def write_json(path, obj):
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(obj, f, indent=1, ensure_ascii=False)
            f.write("\n")
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"fetching {ARENA_URL}")
    arena_entries = parse_arena(fetch(ARENA_URL))
    print(f"  arena: {len(arena_entries)} entries")

    print(f"fetching {OPENROUTER_URL}")
    or_models = parse_openrouter(fetch(OPENROUTER_URL))
    print(f"  openrouter: {len(or_models)} models (after dropping :batch and ~ aliases)")

    overrides = load_overrides()
    (
        combined,
        unmatched,
        collisions,
        method_counts,
        variants_collapsed,
        applied_overrides,
    ) = join(arena_entries, or_models, overrides)
    print(
        f"  join: {len(combined)} models matched "
        f"({method_counts}), {len(unmatched)} arena unmatched, "
        f"{variants_collapsed} config-variant groups collapsed"
    )

    validate(arena_entries, or_models, combined, unmatched)

    unmatched_or = [
        m["id"] for m in or_models if m["id"] not in {c["or_id"] for c in combined}
    ]
    meta = {
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": {
            "arena": {"url": ARENA_URL, "entries": len(arena_entries)},
            "openrouter": {"url": OPENROUTER_URL, "models": len(or_models)},
        },
        "join": {
            "combined": len(combined),
            "unmatched_arena": len(unmatched),
            "unmatched_openrouter": len(unmatched_or),
            "by_method": method_counts,
            "variants_collapsed": variants_collapsed,
            "collisions": collisions,
            "overrides_loaded": len(overrides),
            # overrides actually applied in this run; the site renders these
            # as a disclaimer (identity fixed by explicit owner decision,
            # so the joined price is final)
            "overrides_applied": applied_overrides,
        },
    }

    write_json(OUT_DIR / "arena.json", arena_entries)
    write_json(OUT_DIR / "openrouter.json", or_models)
    write_json(OUT_DIR / "combined.json", combined)
    write_json(OUT_DIR / "meta.json", meta)
    for name in ("arena.json", "openrouter.json", "combined.json", "meta.json"):
        p = OUT_DIR / name
        print(f"  wrote {p.relative_to(ROOT)} ({p.stat().st_size} bytes)")

    print()
    print("match report")
    print(f"  top-20 arena models matched: ", end="")
    top20_unmatched = [
        u["name"]
        for u in unmatched
        if isinstance(u.get("rank"), int) and u["rank"] <= 20
    ]
    print(f"{20 - len(top20_unmatched)}/20" + (f" (missing: {top20_unmatched})" if top20_unmatched else ""))
    print(f"  unmatched arena: {len(unmatched)}")
    for u in unmatched[:30]:
        c = f"  candidates: {u['candidates']}" if u["candidates"] else ""
        print(f"    #{u['rank']:<4} {u['name']}{c}")
    if len(unmatched) > 30:
        print(f"    … and {len(unmatched) - 30} more (see public/data/meta.json)")
    if collisions:
        print(f"  OR key collisions ({len(collisions)}):")
        for c in collisions:
            print(f"    {c}")
    print(f"  unmatched openrouter (not on arena): {len(unmatched_or)}")
    print("done.")


if __name__ == "__main__":
    main()
