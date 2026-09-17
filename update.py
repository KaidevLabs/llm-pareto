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
    print()
    print("logo report")
    for line in logo_lines:
        print(line)
    print("done.")


if __name__ == "__main__":
    main()
