"""Frontier-walk analysis module (plan 044, step 01).

Pure, zero-dep functions over plain dicts for walking the price/Elo
frontier: the frontier itself, its convex-hull supported set, the
per-step walk (price multiples, Elo gains, tok/s deltas, CI-overlap
flags), gate+direction champion selection, and the snapshot readers
the step-02 report is generated from.

The module embeds no analysis constants: Elo gates are inputs to
``champions``/``main`` (044 A5) — they are analysis parameters chosen
per report, not derived constants.
"""

import json
import math
from pathlib import Path

# The front-end speedOf floor (023 D2, mirrored from src/speed.ts): an
# endpoint counts for the speed map only with p50_throughput > 0 and
# request_count >= 30.
SPEED_MIN_REQUESTS = 30


# ---------------------------------------------------------------- loading


def load(*paths):
    """Thin readers for the data files under public/data/.

    Accepts any mix of ``combined.json`` files (a joined-row list),
    ``endpoints.json`` files (the endpoint layer: or_id -> endpoint
    entries) and history snapshots (which embed rows + speed);
    returns the merged list of canonical rows:

        {"id", "price", "elo", "elo_lo", "elo_hi", "speed"}

    ``price`` is $/M output tokens, ``speed`` tok/s. Fields a file
    cannot supply come out ``None``.
    """
    rows = {}
    for path in paths:
        data = json.loads(Path(path).read_text())
        if isinstance(data, list):  # combined.json
            for r in data:
                rows[r["or_id"]] = {
                    "id": r["or_id"],
                    "price": _num(r.get("price_out_per_m")),
                    "elo": _num(r.get("arena_elo")),
                    "elo_lo": _num(r.get("arena_elo_lower")),
                    "elo_hi": _num(r.get("arena_elo_upper")),
                    "speed": None,
                }
        elif isinstance(data, dict) and "rows" in data:  # snapshot
            speed = data.get("speed") or {}
            for r in data["rows"]:
                s = speed.get(r["or_id"])
                rows[r["or_id"]] = {
                    "id": r["or_id"],
                    "price": _num(r.get("price_out_per_m")),
                    "elo": _num(r.get("arena_elo")),
                    "elo_lo": _num(r.get("arena_elo_lower")),
                    "elo_hi": _num(r.get("arena_elo_upper")),
                    "speed": _num(s.get("p50_throughput")) if s else None,
                }
        elif isinstance(data, dict):  # endpoints.json (endpoint layer)
            toks = speed_map(data)
            for or_id in data:
                row = rows.setdefault(
                    or_id,
                    {
                        "id": or_id,
                        "price": None,
                        "elo": None,
                        "elo_lo": None,
                        "elo_hi": None,
                        "speed": None,
                    },
                )
                row["speed"] = toks.get(or_id)
    return sorted(rows.values(), key=lambda r: r["id"])


def _num(v):
    """Coerce a JSON scalar to float; nulls and non-numbers -> None."""
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _median_or_none(vals):
    vals = sorted(v for v in vals if v is not None)
    if not vals:
        return None
    n = len(vals)
    return vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2


def speed_map(endpoints):
    """The rc>=30 median rule (023 D2, mirrored from src/speed.ts)
    applied to the endpoints.json shape: {or_id: median p50 tok/s over
    the endpoints with p50_throughput present and request_count >= 30}.
    Models with no eligible endpoint are omitted."""
    out = {}
    for or_id, eps in endpoints.items():
        toks = _median_or_none(
            [
                e["stats"]["p50_throughput"]
                for e in eps
                if isinstance(e.get("stats"), dict)
                and (e["stats"].get("request_count") or 0)
                >= SPEED_MIN_REQUESTS
                and e["stats"].get("p50_throughput")
            ]
        )
        if toks is not None:
            out[or_id] = toks
    return out


# ---------------------------------------------------------------- analysis


def _dominates(q, p):
    return (
        q["price"] <= p["price"]
        and q["elo"] >= p["elo"]
        and (q["price"] < p["price"] or q["elo"] > p["elo"])
    )


def frontier(rows):
    """The 2-D price/Elo Pareto frontier: the rows no other row
    dominates (a row dominates when it is no worse on both axes and
    strictly better on one). Rows with a missing/zero price or Elo
    are dropped before the walk. Returned price-ascending."""
    pts = [r for r in rows if r.get("price") and r.get("elo")]
    return sorted(
        [p for p in pts if not any(_dominates(q, p) for q in pts)],
        key=lambda p: p["price"],
    )


def supported(front):
    """Split a price-ascending frontier into the points reachable
    as #1 by some linear a*elo - b*log10(price) index (the upper convex
    hull in log-price space) and the provably unreachable concave
    dips. Collinear points on a hull edge are reported unsupported
    (they are only ever tied #1, never strictly reachable)."""
    pts = sorted(
        (math.log10(p["price"]), p["elo"], id(p)) for p in front
    )
    hull = []
    for t in pts:
        while len(hull) >= 2 and _cross(hull[-2], hull[-1], t) >= 0:
            hull.pop()
        hull.append(t)
    ids = {t[2] for t in hull}
    sup = [p for p in front if id(p) in ids]
    uns = [p for p in front if id(p) not in ids]
    return sup, uns


def _cross(o, a, b):
    return (o[0] - b[0]) * (a[1] - b[1]) - (o[1] - b[1]) * (a[0] - b[0])


def walk(front):
    """The frontier walk: one entry per consecutive frontier pair —
    price multiple (ratio), Elo gain (interval-scale difference),
    tok/s delta, and the inside_ci flag (the pair's Elo confidence
    intervals overlap, i.e. the gain is within noise)."""
    steps = []
    for lo, hi in zip(front, front[1:]):
        inside = bool(
            lo.get("elo_hi")
            and hi.get("elo_lo")
            and hi["elo_lo"] <= lo["elo_hi"]
        )
        steps.append(
            {
                "from": lo["id"],
                "to": hi["id"],
                "price_multiple": (
                    hi["price"] / lo["price"] if lo["price"] else None
                ),
                "elo_gain": (
                    hi["elo"] - lo["elo"] if lo["elo"] and hi["elo"] else None
                ),
                "toks_delta": (
                    hi["speed"] - lo["speed"]
                    if lo.get("speed") and hi.get("speed")
                    else None
                ),
                "inside_ci": inside,
            }
        )
    return steps


def champions(rows, gate, direction):
    """Gate + direction selection (044 A2/A3): keep the rows with
    elo >= gate, rank them by the direction ("min_price" or
    "max_speed") and return the ranking — the first entry is the
    class champion, the rest are runners-up. Speed values are
    precomputed by the caller (speed_map), so this function never
    sees the endpoints shape."""
    eligible = [r for r in rows if r.get("elo") and r["elo"] >= gate]
    reverse = direction == "max_speed"
    key = (
        (lambda r: r["speed"] or 0)
        if direction == "max_speed"
        else (
            lambda r: r["price"] if r.get("price") else float("inf")
        )
    )
    return sorted(eligible, key=key, reverse=reverse)


# ---------------------------------------------------------------- report


# The three task classes of plan 044. The gates are analysis
# parameters chosen for the 2026-10-03 snapshot set — NOT derived
# constants (A5); they live here in the CLI so the library stays
# constant-free.
CLASSES = [
    ("batch-cheap", 1450.0, "min_price"),
    ("speed-critical", 1470.0, "max_speed"),
    ("frontier-quality", 1500.0, "max_speed"),
]


def main():
    """The step-02 report generator: walk table, supported set, the
    three task-class champions and the per-snapshot stability
    summary, printed over the live public/data/ files."""
    root = Path(__file__).resolve().parents[1]
    live = load(
        root / "public/data/combined.json",
        root / "public/data/endpoints.json",
    )
    front = frontier(live)
    sup, uns = supported(front)

    print(f"FRONTIER ({len(front)} points, price asc)")
    for p in front:
        toks = f"{p['speed']:.0f}" if p["speed"] else "n/a"
        print(
            f"  {p['id']:45s} $/M={p['price']:<8.4g} "
            f"elo={p['elo']:.1f} [{p['elo_lo']:.1f}, {p['elo_hi']:.1f}] "
            f"tok/s={toks}"
        )
    print("\nWALK (consecutive steps)")
    for s in walk(front):
        tm = f"x{s['price_multiple']:.2f}" if s["price_multiple"] else "n/a"
        eg = (
            f"+{s['elo_gain']:.1f}" if s["elo_gain"] is not None else "n/a"
        )
        td = (
            f"{s['toks_delta']:+.0f} tok/s"
            if s["toks_delta"] is not None
            else "n/a"
        )
        ci = "CI-overlap" if s["inside_ci"] else ""
        print(f"  -> {s['to']:40s} {tm:>8s} {eg:>8s} {td:>12s} {ci}")

    print(f"\nSUPPORTED ({len(sup)}): {[p['id'] for p in sup]}")
    print(f"UNREACHABLE ({len(uns)}): {[p['id'] for p in uns]}")

    print("\nTASK-CLASS CHAMPIONS (champion, runner-up)")
    for name, gate, direction in CLASSES:
        ranked = champions(live, gate, direction)
        top = ", ".join(r["id"] for r in ranked[:2]) if ranked else "none"
        print(f"  {name:20s} gate {gate:g}, {direction:10s}: {top}")

    print("\nSTABILITY (per snapshot, oldest first)")
    for path in sorted((root / "public/data/history").glob("*.json")):
        if path.name == "index.json":
            continue
        sf = frontier(load(path))
        print(
            f"  {path.stem}: {len(sf)} points, "
            f"top={sf[-1]['id'] if sf else 'none'}"
        )


if __name__ == "__main__":
    main()
