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
import statistics
import struct
import sys
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ARENA_URL = "https://lmarena.ai/leaderboard/text"
OPENROUTER_URL = "https://openrouter.ai/api/v1/models"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) llm-arena-pareto-updater/1.0"
TIMEOUT = 60
FETCH_ATTEMPTS = 3
RETRY_BASE_DELAY = 2

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


class _PageFormatError(Exception):
    """parse_provider_page signals 'anchor missing' without exiting, so the
    fetch seam can treat it as transient and re-fetch (see
    fetch_parse_model_page)."""


def _is_transient(e):
    """True for fetch failures worth retrying: 5xx/429 responses,
    timeouts, and connection-level errors (plan 013, D5)."""
    if isinstance(e, urllib.error.HTTPError):
        return e.code == 429 or 500 <= e.code < 600
    return isinstance(e, (urllib.error.URLError, TimeoutError, ConnectionError))


def fetch(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
        },
    )
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception as e:
            if attempt == FETCH_ATTEMPTS or not _is_transient(e):
                die(f"fetch failed: {url}: {e}")
            delay = RETRY_BASE_DELAY * 2 ** (attempt - 1)
            print(
                f"fetch: attempt {attempt}/{FETCH_ATTEMPTS} failed ({e}); "
                f"retrying in {delay}s"
            )
            time.sleep(delay)


# ---------------------------------------------------------------- arena

def _decode_chunk(raw):
    try:
        return json.loads(f'"{raw}"')
    except Exception:
        return raw.encode("utf-8").decode("unicode_escape", errors="replace")


def _extract_json_array(text, key, from_i=0, label="arena"):
    i = text.find(key, from_i)
    if i < 0:
        die(
            f"{label}: anchor {key!r} not found in page payload "
            "(page format changed?)"
        )
    start = text.find("[", i)
    if start < 0:
        die(f"{label}: no array after {key!r} (page format changed?)")
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
                        die(f"{label}: failed to parse entries array: {e}")
    die(f"{label}: unterminated entries array (page format changed?)")


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
                "arena_model_url": best.get("modelUrl"),
                "arena_price_in_per_m": best.get("inputPricePerMillion"),
                "arena_price_out_per_m": best.get("outputPricePerMillion"),
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


# --------------------------------------------- provider layer (plan 022)

ENDPOINTS_URL = "https://openrouter.ai/api/v1/models/{or_id}/endpoints"
MODEL_PAGE_URL = "https://openrouter.ai/{or_id}"
PROVIDER_TMP_DIR = ROOT / ".tmp" / "provider"
PROVIDER_FETCH_SPACING = 0.5


def fetch_endpoints(or_id):
    """Per-model provider endpoint list from the public API (plan 022,
    D1): provider list, pricing, uptime — raw JSON text."""
    return fetch(ENDPOINTS_URL.format(or_id=or_id))


def fetch_model_page(or_id):
    """The OR model page SSR payload (plan 022, D1): source of the speed
    percentiles + the page-only rich fields — raw HTML text."""
    return fetch(MODEL_PAGE_URL.format(or_id=or_id))


# OpenRouter's model page sometimes ships a partial SSR render without the
# dehydrated endpointStats (observed 2026-09-18: 15/154 pages in one run;
# the same URL re-fetched immediately carries it). Treat a missing anchor
# as transient: re-fetch the page, then die if it never appears — a page
# that NEVER has it is format drift and must fail the run (022 D1).
PAGE_PARSE_ATTEMPTS = 3


def fetch_parse_model_page(or_id):
    last_err = None
    for attempt in range(1, PAGE_PARSE_ATTEMPTS + 1):
        page = fetch_model_page(or_id)
        try:
            return parse_provider_page(page), page
        except SystemExit:
            raise
        except _PageFormatError as e:
            last_err = e
            if attempt < PAGE_PARSE_ATTEMPTS:
                print(
                    f"  provider: {or_id}: page missing endpointStats "
                    f"(attempt {attempt}/{PAGE_PARSE_ATTEMPTS}); re-fetching"
                )
                time.sleep(RETRY_BASE_DELAY * attempt)
    die(f"provider: {or_id}: {last_err}")


def fetch_provider_layer(or_ids):
    """Sequential fetch loop over the joined or_ids (plan 022, D9):
    0.5 s spacing between fetches, both sources per model, raw payloads
    to .tmp/provider/ (gitignored — never committed). Prints per-source
    fetch counts. Returns [(or_id, endpoints_raw, page_html), ...]."""
    PROVIDER_TMP_DIR.mkdir(parents=True, exist_ok=True)
    total = len(or_ids)
    payloads = []
    for i, or_id in enumerate(or_ids, 1):
        ep = fetch_endpoints(or_id)
        ep_path = PROVIDER_TMP_DIR / f"ep_{or_id.replace('/', '__')}.json"
        ep_path.write_text(ep)
        time.sleep(PROVIDER_FETCH_SPACING)
        page_eps, page = fetch_parse_model_page(or_id)
        page_path = PROVIDER_TMP_DIR / f"page_{or_id.replace('/', '__')}.html"
        page_path.write_text(page)
        payloads.append((or_id, ep, page, page_eps))
        if i < total:
            time.sleep(PROVIDER_FETCH_SPACING)
    print(
        f"  provider layer: {total} models — fetched {len(payloads)} endpoint "
        f"payloads, {len(payloads)} page payloads -> .tmp/provider/"
    )
    return payloads


EP_STATS_ANCHOR = '"queryKey":["model-page","endpointStats"'
DEHYDRATED_AT = '"dehydratedAt":'


def parse_provider_page(html):
    """The model page's endpointStats array (plan 022, D1): dehydrated
    endpoint objects carrying the populated speed stats. Same RSC surface
    as arena.ai — new anchor (the endpointStats queryKey, then the
    dehydratedAt data array that follows it)."""
    chunks = RSC_RE.findall(html)
    if not chunks:
        die("provider: no RSC chunks found in page (page format changed?)")
    text = "".join(_decode_chunk(c) for c in chunks)
    i = text.find(EP_STATS_ANCHOR)
    if i < 0:
        raise _PageFormatError(
            "endpointStats queryKey not found in page payload "
            "(page format changed?)"
        )
    j = text.find(DEHYDRATED_AT, i)
    if j < 0:
        raise _PageFormatError(
            "no dehydratedAt after endpointStats queryKey "
            "(page format changed?)"
        )
    eps = _extract_json_array(text, DEHYDRATED_AT, from_i=j, label="provider")
    if not isinstance(eps, list) or not all(isinstance(e, dict) for e in eps):
        die("provider: endpointStats array is not a list of objects")
    return eps


def parse_endpoints_api(raw):
    """The per-model endpoints API response (plan 022, D1): raw endpoint
    list — provider list, pricing, uptime."""
    try:
        data = json.loads(raw)
    except Exception as e:
        die(f"provider: bad endpoints JSON: {e}")
    eps = (data.get("data") or {}).get("endpoints")
    if not isinstance(eps, list):
        die("provider: no endpoints list in API response "
            "(API format changed?)")
    for e in eps:
        if not isinstance(e, dict):
            die(f"provider: non-object endpoint in API list: {e!r}")
    return eps


def _uptime_populated(e):
    return sum(
        1
        for k in ("uptime_last_1d", "uptime_last_5m", "uptime_last_30m")
        if e.get(k) is not None
    )


def merge_duplicate_endpoints(api_eps):
    """Exact (provider_name, tag, model_id) duplicates collapse to the
    entry with the more populated uptime (plan 022, D6); dated variants
    (same provider + tag, different model_id) stay distinct. Returns
    (entries, n_merged)."""
    merged = []
    seen = {}
    for e in api_eps:
        key = (e.get("provider_name"), e.get("tag"), e.get("model_id"))
        if key not in seen:
            seen[key] = len(merged)
            merged.append(e)
        elif _uptime_populated(e) > _uptime_populated(merged[seen[key]]):
            merged[seen[key]] = e
    return merged, len(api_eps) - len(merged)


# speed stats kept per endpoint (plan 022, D4): the 30-min rolling window,
# values as received (the page emits ints / 0.5-granular floats)
_STATS_KEYS = (
    "p50_latency",
    "p75_latency",
    "p90_latency",
    "p95_latency",
    "p99_latency",
    "p50_throughput",
    "p75_throughput",
    "p90_throughput",
    "p95_throughput",
    "p99_throughput",
    "latency_request_count",
    "throughput_request_count",
    "request_count",
    "window_minutes",
)


def round_uptime(value):
    """uptime_last_1d at 0.1% granularity (plan 022, D5)."""
    if value is None:
        return None
    return round(value, 1)


def _page_stats(ep):
    s = ep.get("stats")
    if not isinstance(s, dict):
        return None
    return {k: s.get(k) for k in _STATS_KEYS}


def _entry_from_api(a, p):
    """One committed entry (plan 022, step 2 schema): the API endpoint's
    fields + the linked page endpoint's rich fields + whitelisted stats.
    p is None for API-only endpoints."""
    return {
        "provider": a.get("provider_name"),
        "tag": a.get("tag"),
        "model_id": a.get("model_id"),
        "pricing": a.get("pricing"),
        "context_length": a.get("context_length"),
        "max_completion_tokens": a.get("max_completion_tokens"),
        "quantization": a.get("quantization"),
        "status": a.get("status"),
        "uptime_last_1d": round_uptime(a.get("uptime_last_1d")),
        "supported_parameters": a.get("supported_parameters"),
        "adapter": p.get("adapter_name") if p else None,
        "data_policy": p.get("data_policy") if p else None,
        "limit_rpm": p.get("limit_rpm") if p else None,
        "limit_rpd": p.get("limit_rpd") if p else None,
        "provider_info": p.get("provider_info") if p else None,
        "provider_region": p.get("provider_region") if p else None,
        "is_hipaa_eligible": p.get("is_hipaa_eligible") if p else None,
        "is_hidden": p.get("is_hidden") if p else None,
        "is_deranked": p.get("is_deranked") if p else None,
        "is_free": p.get("is_free") if p else None,
        "created_at": p.get("created_at") if p else None,
        "deprecation_date": p.get("deprecation_date") if p else None,
        "supports_reasoning": p.get("supports_reasoning") if p else None,
        "pricing_version_id": p.get("pricing_version_id") if p else None,
        "stats": _page_stats(p) if p else None,
    }


def _entry_from_page(p):
    """A page endpoint that did not join the API list (plan 022, D3): kept,
    stats only — the API-only uptime stays null."""
    return {
        "provider": p.get("provider_name"),
        "tag": p.get("provider_slug"),
        "model_id": p.get("model_variant_permaslug"),
        "pricing": p.get("pricing"),
        "context_length": p.get("context_length"),
        "max_completion_tokens": p.get("max_completion_tokens"),
        "quantization": p.get("quantization"),
        "status": p.get("status"),
        "uptime_last_1d": None,
        "supported_parameters": p.get("supported_parameters"),
        "adapter": p.get("adapter_name"),
        "data_policy": p.get("data_policy"),
        "limit_rpm": p.get("limit_rpm"),
        "limit_rpd": p.get("limit_rpd"),
        "provider_info": p.get("provider_info"),
        "provider_region": p.get("provider_region"),
        "is_hipaa_eligible": p.get("is_hipaa_eligible"),
        "is_hidden": p.get("is_hidden"),
        "is_deranked": p.get("is_deranked"),
        "is_free": p.get("is_free"),
        "created_at": p.get("created_at"),
        "deprecation_date": p.get("deprecation_date"),
        "supports_reasoning": p.get("supports_reasoning"),
        "pricing_version_id": p.get("pricing_version_id"),
        "stats": _page_stats(p),
    }


def join_provider_layers(api_eps, page_eps):
    """Join page stats + rich fields onto the authoritative API endpoints
    (plan 022, D3). Key: (provider_name, tag) — a page endpoint resolves
    its tag via provider_slug first (exact), then provider_info.slug;
    only a unique match joins. Returns (entries, unjoined_entries,
    n_joined); unjoined page endpoints are kept, stats only."""
    by_name = {}
    for a in api_eps:
        by_name.setdefault(
            (a.get("provider_name") or "").lower(), []
        ).append(a)
    matched = {}
    for idx, p in enumerate(page_eps):
        cands = by_name.get((p.get("provider_name") or "").lower(), [])
        slug = p.get("provider_slug")
        info = p.get("provider_info") or {}
        exact = [a for a in cands if slug is not None and a.get("tag") == slug]
        if len(exact) == 1:
            matched[idx] = exact[0]
        else:
            info_slug = info.get("slug")
            fb = [
                a for a in cands
                if info_slug is not None and a.get("tag") == info_slug
            ]
            if len(fb) == 1:
                matched[idx] = fb[0]
    picked = {}
    for idx, a in matched.items():
        p = page_eps[idx]
        rc = (p.get("stats") or {}).get("request_count") or 0
        cur = picked.get(id(a))
        if cur is None or rc > cur[0]:
            picked[id(a)] = (rc, p)
    entries = []
    for a in api_eps:
        cell = picked.get(id(a))
        entries.append(_entry_from_api(a, cell[1] if cell else None))
    unjoined = [
        _entry_from_page(p)
        for idx, p in enumerate(page_eps)
        if idx not in matched
    ]
    return entries, unjoined, len(matched)


def build_provider_layer(raw_layers):
    """[(or_id, endpoints_raw, page_html), ...] -> ({or_id: entries},
    report) for the validation + write (plan 022, steps 2-3). The API list
    is authoritative; the page contributes stats + rich fields (D3)."""
    layer = {}
    rep = {
        "models": 0,
        "api_endpoints": 0,
        "page_endpoints": 0,
        "joined": 0,
        "page_unjoined": 0,
        "duplicates_merged": 0,
        "entries": 0,
        "entries_with_stats": 0,
        "models_detail": [],
        "join_misses": [],
        "providers_distinct": 0,
        "top_providers": [],
    }
    provider_counts = {}
    for or_id, ep_raw, page_html, page_eps in raw_layers:
        api_eps = parse_endpoints_api(ep_raw)
        merged, n_merged = merge_duplicate_endpoints(api_eps)
        entries, unjoined, n_joined = join_provider_layers(merged, page_eps)
        all_entries = entries + unjoined
        layer[or_id] = all_entries
        n_stats = sum(1 for e in all_entries if e["stats"] is not None)
        rep["models"] += 1
        rep["api_endpoints"] += len(api_eps)
        rep["page_endpoints"] += len(page_eps)
        rep["joined"] += n_joined
        rep["page_unjoined"] += len(unjoined)
        rep["duplicates_merged"] += n_merged
        rep["entries"] += len(all_entries)
        rep["entries_with_stats"] += n_stats
        rep["models_detail"].append(
            {
                "or_id": or_id,
                "api_endpoints": len(api_eps),
                "page_endpoints": len(page_eps),
                "joined": n_joined,
                "page_unjoined": len(unjoined),
                "duplicates_merged": n_merged,
                "entries": len(all_entries),
                "entries_with_stats": n_stats,
            }
        )
        rep["join_misses"].extend(
            f"{or_id}: {e['provider']} ({e['tag']})" for e in unjoined
        )
        for e in all_entries:
            provider_counts[e["provider"]] = (
                provider_counts.get(e["provider"], 0) + 1
            )
    rep["providers_distinct"] = len(provider_counts)
    rep["top_providers"] = sorted(
        provider_counts.items(), key=lambda kv: (-kv[1], kv[0])
    )[:10]
    return layer, rep


# --- provider validation, report, write (plan 022, step 3)

ENDPOINTS_PATH = OUT_DIR / "endpoints.json"
MODELS_WITH_STATS_HARD_MIN = 0.5
MODELS_WITH_STATS_WARN_MIN = 0.8
JOIN_HIT_RATE_MIN = 0.90


def validate_provider_layer(layer, detail):
    """D8 bands + structural floors (plan 022). Dies on a violation —
    before any file is written. detail = the models_detail rows from
    build_provider_layer; layer = {or_id: entries}."""
    n = len(detail)
    if not n:
        die("provider: layer is empty (no joined models?)")
    zero_api = [r["or_id"] for r in detail if r["api_endpoints"] == 0]
    if zero_api:
        die(f"provider: {len(zero_api)} model(s) with 0 API endpoints: "
            f"{zero_api[:5]}")
    with_stats = sum(1 for r in detail if r["entries_with_stats"] > 0)
    if with_stats / n < MODELS_WITH_STATS_HARD_MIN:
        die(
            f"provider: only {with_stats}/{n} models have stats "
            f"(need >= {MODELS_WITH_STATS_HARD_MIN:.0%})"
        )
    if with_stats / n < MODELS_WITH_STATS_WARN_MIN:
        print(
            f"  provider warn: {with_stats}/{n} models with stats "
            f"({100 * with_stats / n:.0f}%) below "
            f"{MODELS_WITH_STATS_WARN_MIN:.0%}"
        )
    page_total = sum(r["page_endpoints"] for r in detail)
    joined = sum(r["joined"] for r in detail)
    if page_total and joined / page_total < JOIN_HIT_RATE_MIN:
        die(
            f"provider: join hit rate {joined}/{page_total} "
            f"({100 * joined / page_total:.0f}%) below {JOIN_HIT_RATE_MIN:.0%}"
        )
    for or_id in sorted(layer):
        for e in layer[or_id]:
            s = e.get("stats")
            if isinstance(s, dict):
                for metric in ("latency", "throughput"):
                    present = [
                        s.get(f"p{q}_{metric}")
                        for q in (50, 75, 90, 95, 99)
                        if s.get(f"p{q}_{metric}") is not None
                    ]
                    if any(a > b for a, b in zip(present, present[1:])):
                        die(
                            f"provider: {or_id}: {e.get('provider')}: "
                            f"{metric} percentiles not monotonic: {present}"
                        )
                    if metric == "throughput" and any(v == 0 for v in present):
                        die(
                            f"provider: {or_id}: {e.get('provider')}: "
                            f"throughput percentile is 0: {present}"
                        )
            price = (e.get("pricing") or {}).get("prompt")
            if price is not None and float(price) <= 0:
                die(
                    f"provider: {or_id}: {e.get('provider')}: "
                    f"prompt price not > 0: {price!r}"
                )


def provider_report_lines(rep):
    """The provider report section lines (plan 022, step 3)."""
    counts = [r["entries"] for r in rep["models_detail"]]
    n = len(counts)
    med = statistics.median(counts)
    med_s = str(int(med)) if float(med) == int(med) else str(med)
    with_stats_models = sum(
        1 for r in rep["models_detail"] if r["entries_with_stats"]
    )
    lines = [
        f"  endpoints per model: min {min(counts)}, median {med_s}, "
        f"max {max(counts)} ({n} models)",
        f"  providers distinct: {rep['providers_distinct']}",
        f"  stats coverage: {with_stats_models}/{n} models "
        f"({100 * with_stats_models / n:.0f}%), "
        f"{rep['entries_with_stats']}/{rep['entries']} endpoints "
        f"({100 * rep['entries_with_stats'] / rep['entries']:.0f}%)",
        f"  join misses: {rep['page_unjoined']} page endpoints",
    ]
    for miss in rep["join_misses"][:10]:
        lines.append(f"    {miss}")
    if len(rep["join_misses"]) > 10:
        lines.append(f"    … and {len(rep['join_misses']) - 10} more")
    lines.append(f"  duplicates merged: {rep['duplicates_merged']}")
    lines.append(
        "  top providers by endpoints: "
        + ", ".join(f"{name} ({c})" for name, c in rep["top_providers"])
    )
    return lines


def write_endpoints(layer, path=ENDPOINTS_PATH):
    """Canonical atomic write of endpoints.json (plan 022, D2/D7) — only
    when state changed, like logos.json. Returns True when written."""
    path = Path(path)
    new_text = json.dumps(
        {k: layer[k] for k in sorted(layer)}, indent=1, ensure_ascii=False
    ) + "\n"
    old_text = path.read_text() if path.exists() else None
    if old_text == new_text:
        return False
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(new_text)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    return True


# ---------------------------------------------------------------- logos

# logo registry (plan 007, D8): logos.json at repo root maps
# org -> {file, url, license, fetched}. update.py owns the file:
# entries are auto-created for orgs in the data, missing files are
# fetched from the entry's url and square-verified, and the file is
# rewritten canonically only when the state changes. Soft domain:
# logo trouble reports, never dies. Human-owned fields: url, license,
# transform (one-shot curation notes).
LOGOS_PATH = ROOT / "logos.json"
LOGOS_DIR = ROOT / "public" / "assets" / "logos"
LOGO_MAX_BYTES = 512 * 1024
LOGO_TIMEOUT = 30


def logo_slug(org):
    """Deterministic asset slug for an org name: 'Z.ai' -> 'z-ai'."""
    return re.sub(r"[^a-z0-9]+", "-", org.lower()).strip("-")


def sniff_image(data):
    """Return the image kind ('svg'/'png'/'jpg'/'avif'/'ico') or None.

    Magic bytes, not Content-Type headers — CDNs lie.
    """
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:4] == b"\x00\x00\x01\x00":
        return "ico"
    if data[4:8] == b"ftyp" and data[8:12] in (b"avif", b"avis"):
        return "avif"
    head = data.lstrip(b" \t\r\n\xef\xbb\xbf")
    if head.startswith((b"<?xml", b"<svg")) or b"<svg" in head[:300]:
        return "svg"
    return None


def png_size(data):
    """(width, height) from the PNG IHDR chunk, or None if not readable.

    Layout: signature(8) + chunk length(4) + "IHDR"(4) + width(4BE)
    + height(4BE) — width/height live at bytes 16:24.
    """
    if len(data) < 24 or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def svg_viewbox(data):
    """(x, y, width, height) from the SVG viewBox attribute, or None."""
    m = re.search(rb'viewBox="([^"]+)"', data)
    if not m:
        return None
    try:
        return tuple(float(v) for v in m.group(1).split())
    except ValueError:
        return None


def ico_best_png_frame(data):
    """Bytes of the largest PNG-encoded frame in an ICO file, or None.

    ICO layout: header(6) + 16-byte directory entries (size/offset at
    entry bytes 8:16) + the frame payloads themselves.
    """
    if len(data) < 6 or data[:4] != b"\x00\x00\x01\x00":
        return None
    (count,) = struct.unpack_from("<H", data, 4)
    best = None
    for i in range(count):
        entry = 6 + 16 * i
        if entry + 16 > len(data):
            break  # truncated directory: keep what we have
        size, offset = struct.unpack_from("<II", data, entry + 8)
        payload = data[offset : offset + size]
        if payload[:8] == b"\x89PNG\r\n\x1a\n" and (
            best is None or size > len(best)
        ):
            best = payload
    return best


def _num(v):
    """Shortest round-trip formatting for SVG attributes."""
    return repr(v)


def normalize_svg(data):
    """Square-normalize an SVG in memory: expand the viewBox to a square
    (content centered) and set explicit width/height. Returns new bytes,
    or None when there is no viewBox to work from (manual path)."""
    vb = svg_viewbox(data)
    if vb is None:
        return None
    x, y, w, h = vb
    if abs(w - h) > 1e-9:
        side = max(w, h)
        x = x + w / 2 - side / 2
        y = y + h / 2 - side / 2
        w = h = side
    m = re.search(rb"<svg[^>]*>", data)
    if not m:
        return None
    root = m.group(0)
    root = re.sub(rb'\s+(?:width|height)="[^"]*"', b"", root)
    root = re.sub(rb'\s+viewBox="[^"]*"', b"", root)
    if root.endswith(b"/>"):
        body, close = root[:-2], b"/>"
    else:
        body, close = root[:-1], b">"
    attrs = 'viewBox="%s %s %s %s" width="%s" height="%s"' % (
        _num(x), _num(y), _num(w), _num(h), _num(w), _num(w)
    )
    return (
        data[: m.start()]
        + body.rstrip()
        + b" "
        + attrs.encode()
        + close
        + data[m.end() :]
    )


def load_logos(path):
    """Load the logo registry; missing file is an empty registry.

    A corrupt repo file is a hard error, like overrides.json — logo
    *trouble* (network, assets) is the soft domain, repo state is not.
    """
    if not path.exists():
        return {}
    try:
        man = json.loads(path.read_text())
    except Exception as e:
        die(f"logos.json: bad JSON: {e}")
    if not isinstance(man, dict):
        die("logos.json: expected {org: {file, url, license, fetched}}")
    return man


def logo_candidates(org, slug):
    """Source candidates probed for a new org without a url (soft hints:
    the report shows which are reachable; picking the right one is a
    human decision, recorded in the entry's url)."""
    return (
        f"https://cdn.simpleicons.org/{slug}",
        f"https://cdn.worldvectorlogo.com/logos/{slug}.svg",
        f"https://openrouter.ai/images/icons/{org}.svg",
    )


def fetch_logo(url):
    """Soft fetch: bytes or None — logo trouble never dies."""
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": USER_AGENT, "Accept": "image/*"}
        )
        with urllib.request.urlopen(req, timeout=LOGO_TIMEOUT) as r:
            return r.read(LOGO_MAX_BYTES + 1)
    except Exception:
        return None


def _fetch_many(urls, fetcher, max_workers=8):
    """Parallel soft fetch: {url: bytes|None}. A raising fetcher is
    caught per-url — the soft domain holds even with custom fetchers."""
    if not urls:
        return {}

    def soft(url):
        try:
            return fetcher(url)
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        results = list(pool.map(soft, urls))
    return dict(zip(urls, results))


def _file_check(path):
    """(kind, square, detail) for an asset already on disk."""
    data = path.read_bytes()
    kind = sniff_image(data)
    if kind == "svg":
        vb = svg_viewbox(data)
        return (
            kind,
            vb is not None and abs(vb[2] - vb[3]) <= 1e-9,
            "no viewBox" if vb is None else "square",
        )
    if kind == "png":
        size = png_size(data)
        if size is None:
            return kind, False, "unparsed IHDR"
        square = size[0] == size[1]
        suffix = " square" if square else " not square"
        return kind, square, f"{size[0]}x{size[1]}{suffix}"
    return kind, False, "raster"


def _canon_entry(e):
    out = {}
    for k in ("file", "url", "license", "fetched"):
        if k in e:
            out[k] = e[k]
    for k in sorted(e):
        if k not in ("file", "url", "license", "fetched"):
            out[k] = e[k]
    return out


def logos_sync(
    orgs, manifest, log_dir, log_path, fetcher=fetch_logo, today=None
):
    """Sync the logo registry (plan 007, D8). Returns (manifest, lines).

    For every org in the data: a missing file with a url gets fetched,
    verified (type, size cap, squareness — SVGs square-normalized on
    write) and placed; a missing url gets a candidate probe. Files land
    even when flagged manual — the site reads the org->file map from
    meta.json, so no app-side change is needed for a new logo. The
    registry is rewritten canonically only when the state changed.
    Soft domain: everything reports, nothing raises.
    """
    lines = []
    if today is None:
        today = datetime.now(timezone.utc).date().isoformat()
    manifest = {org: dict(entry) for org, entry in manifest.items()}
    log_dir.mkdir(parents=True, exist_ok=True)
    orgs = sorted(set(orgs))
    n_ok = n_manual = n_new = 0

    def map_line(org, fname):
        return f'  logo: wrote {fname} for "{org}"'

    # phase 1 (no network): classify each org and collect the urls to fetch
    plan = {}
    for org in orgs:
        entry = manifest.get(org) or {}
        slug = logo_slug(org)
        fname = entry.get("file")
        fpath = (log_dir / fname) if fname else None
        if fpath is not None and fpath.exists():
            plan[org] = ("existing", fpath)
        elif entry.get("url"):
            plan[org] = ("fetch", entry["url"])
        else:
            # discovered asset: a slug-named file on disk with no registry
            # entry yet (committed by hand, or the org dropped out and came
            # back)
            guess = None
            for ext in ("svg", "png", "jpg", "avif", "ico"):
                p = log_dir / f"{slug}.{ext}"
                if p.exists():
                    guess = p
                    break
            if guess is not None:
                plan[org] = ("discovered", guess)
            else:
                plan[org] = ("new", logo_candidates(org, slug))

    fetch_urls = set()
    for tag, *rest in plan.values():
        if tag == "fetch":
            fetch_urls.add(rest[0])
        elif tag == "new":
            fetch_urls.update(rest[0])
    fetched = _fetch_many(sorted(fetch_urls), fetcher)

    # phase 2 (deterministic order): verify, write, report
    for org in orgs:
        tag, payload = plan[org]
        entry = manifest.get(org) or {}
        slug = logo_slug(org)

        if tag in ("existing", "discovered"):
            fpath = payload
            kind, square, detail = _file_check(fpath)
            if tag == "discovered":
                entry = {"file": fpath.name, "url": None}
                manifest[org] = entry
            if square:
                n_ok += 1
                if tag == "discovered":
                    lines.append(
                        f'  logo: "{org}": file {fpath.name} present without '
                        f"url (provenance unknown)"
                    )
            else:
                n_manual += 1
                lines.append(
                    f'  logo: "{org}": {fpath.name} needs manual normalize '
                    f"({kind} {detail})"
                )
            continue

        if tag == "new":
            entry = {"file": None, "url": None}
            manifest[org] = entry
            n_new += 1
            cand = [
                (c if fetched.get(c) is None else c + " [ok]")
                for c in payload
            ]
            lines.append(
                f'  logo: new org "{org}" — no url; candidates: '
                + ", ".join(cand)
            )
            continue

        url = payload
        data = fetched.get(url)
        if data is None:
            entry = {**entry, "file": entry.get("file") or None}
            manifest[org] = entry
            lines.append(
                f'  logo: "{org}": fetch failed ({url}) — soft; '
                f"fix the url and re-run"
            )
            continue
        if len(data) > LOGO_MAX_BYTES:
            entry = {**entry, "file": None}
            manifest[org] = entry
            lines.append(
                f'  logo: "{org}": {len(data)} bytes > {LOGO_MAX_BYTES} — '
                f"oversize, manual"
            )
            continue
        kind = sniff_image(data)
        if kind is None:
            entry = {**entry, "file": None}
            manifest[org] = entry
            lines.append(
                f'  logo: "{org}": unknown image type ({url}) — manual'
            )
            continue

        if kind == "svg":
            vb = svg_viewbox(data)
            out = normalize_svg(data) if vb is not None else data
            fname = f"{slug}.svg"
            (log_dir / fname).write_bytes(out)
            entry["file"] = fname
            entry["fetched"] = today
            manifest[org] = entry
            if vb is None:
                n_manual += 1
                lines.append(
                    f'  logo: "{org}": svg without viewBox — manual normalize '
                    f"(file written)"
                )
            else:
                n_ok += 1
                lines.append(map_line(org, fname))
        elif kind == "ico":
            frame = ico_best_png_frame(data)
            if frame is not None:
                fname = f"{slug}.png"
                (log_dir / fname).write_bytes(frame)
                entry["file"] = fname
                entry["fetched"] = today
                manifest[org] = entry
                size = png_size(frame)
                square = size is not None and size[0] == size[1]
                if square:
                    n_ok += 1
                    lines.append(map_line(org, fname))
                else:
                    n_manual += 1
                    dims = f"{size[0]}x{size[1]}" if size else "unparsed"
                    lines.append(
                        f'  logo: "{org}": ico frame {dims} not square — '
                        f"manual normalize (file written)"
                    )
            else:
                fname = f"{slug}.ico"
                (log_dir / fname).write_bytes(data)
                entry["file"] = fname
                entry["fetched"] = today
                manifest[org] = entry
                n_manual += 1
                lines.append(
                    f'  logo: "{org}": ico without png frame — manual '
                    f"(file written)"
                )
        else:  # png / jpg / avif
            fname = f"{slug}.{kind}"
            (log_dir / fname).write_bytes(data)
            entry["file"] = fname
            entry["fetched"] = today
            manifest[org] = entry
            if kind == "png":
                size = png_size(data)
                if size is not None and size[0] == size[1]:
                    n_ok += 1
                    lines.append(map_line(org, fname))
                else:
                    dims = f"{size[0]}x{size[1]}" if size else "unparsed"
                    n_manual += 1
                    lines.append(
                        f'  logo: "{org}": png {dims} not square — manual '
                        f"normalize (file written)"
                    )
            else:
                n_manual += 1
                lines.append(
                    f'  logo: "{org}": {kind} raster — manual normalize '
                    f"(knockout / recolor / resize) (file written)"
                )

    for org in sorted(set(manifest) - set(orgs)):
        lines.append(f'  logo: stale "{org}" — not in current data (kept)')

    lines.append(
        f"  logos: {len(orgs)} orgs — {n_ok} ok, {n_manual} manual, "
        f"{n_new} new without url"
    )

    canon = {org: _canon_entry(manifest[org]) for org in sorted(manifest)}
    new_text = json.dumps(canon, indent=1, ensure_ascii=False) + "\n"
    old_text = log_path.read_text() if log_path.exists() else None
    if old_text != new_text:
        fd, tmp = tempfile.mkstemp(dir=log_path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as f:
                f.write(new_text)
            os.replace(tmp, log_path)
        except BaseException:
            if os.path.exists(tmp):
                os.unlink(tmp)
            raise
    return manifest, lines


def logos_for_site(manifest, log_dir):
    """org -> served filename, for the site map in meta.json.

    Only entries with a file actually on disk: the site derives the
    asset path mechanically (assets/logos/<file>), so the app needs no
    map of its own and a new org's logo needs no JS change.
    """
    out = {}
    for org, entry in manifest.items():
        fname = entry.get("file")
        if fname and (log_dir / fname).exists():
            out[org] = fname
    return out


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

    # provider layer (plan 022): raw per-model fetch to .tmp/provider/ +
    # parse/normalize — after validate() so a failing run fetches nothing
    print(f"fetching provider layer for {len(combined)} joined models")
    raw_layers = fetch_provider_layer([c["or_id"] for c in combined])
    provider_layer, provider_rep = build_provider_layer(raw_layers)
    print(
        f"  provider layer: {len(provider_layer)} models — "
        f"{provider_rep['entries']} endpoint entries "
        f"({provider_rep['joined']} page stats joined, "
        f"{provider_rep['page_unjoined']} page-only, "
        f"{provider_rep['duplicates_merged']} duplicates merged, "
        f"{provider_rep['entries_with_stats']} with stats)"
    )
    # D8 bands: a violation dies here, before any file is written
    validate_provider_layer(provider_layer, provider_rep["models_detail"])

    # logos (soft domain: reports, never dies — plan 007 D8); runs before
    # the meta write so the org->file map lands in meta.json
    logo_orgs = sorted({c["arena_org"] for c in combined if c.get("arena_org")})
    logo_manifest, logo_lines = logos_sync(
        logo_orgs, load_logos(LOGOS_PATH), LOGOS_DIR, LOGOS_PATH
    )

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
        # org -> filename served from assets/logos/; the site derives the
        # path mechanically, so new logos need no app-side change
        "logos": logos_for_site(logo_manifest, LOGOS_DIR),
        # provider layer provenance (plan 022, D2): source URLs, counts,
        # stats coverage
        "provider": {
            "sources": {
                "endpoints_api": ENDPOINTS_URL,
                "model_page": MODEL_PAGE_URL,
            },
            "models": len(provider_layer),
            "endpoints": provider_rep["entries"],
            "stats": {
                "models_with_stats": sum(
                    1 for r in provider_rep["models_detail"]
                    if r["entries_with_stats"]
                ),
                "endpoints_with_stats": provider_rep["entries_with_stats"],
            },
            "joined_page_endpoints": provider_rep["joined"],
            "page_endpoints_unjoined": provider_rep["page_unjoined"],
            "duplicates_merged": provider_rep["duplicates_merged"],
        },
    }

    write_json(OUT_DIR / "arena.json", arena_entries)
    write_json(OUT_DIR / "openrouter.json", or_models)
    write_json(OUT_DIR / "combined.json", combined)
    write_json(OUT_DIR / "meta.json", meta)
    for name in ("arena.json", "openrouter.json", "combined.json", "meta.json"):
        p = OUT_DIR / name
        print(f"  wrote {p.relative_to(ROOT)} ({p.stat().st_size} bytes)")
    if write_endpoints(provider_layer):
        print(
            f"  wrote {ENDPOINTS_PATH.relative_to(ROOT)} "
            f"({ENDPOINTS_PATH.stat().st_size} bytes)"
        )
    else:
        print(f"  {ENDPOINTS_PATH.relative_to(ROOT)} unchanged")

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
    print()
    print("logo report")
    for line in logo_lines:
        print(line)
    print("provider report")
    for line in provider_report_lines(provider_rep):
        print(line)
    print("done.")


if __name__ == "__main__":
    main()
