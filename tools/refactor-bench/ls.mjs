// 042: list the published bench registry — `npm run bench:ls`. Registry
// order (append order), one row per entry: id / date / label / KB. The
// footer names the default compare pair — the last two entries, 033 A1.
// An empty registry prints `0 published entries` and exits 0.
import path from "node:path";
import { listEntries } from "./lib/registry.mjs";

const root = process.cwd();
const bench = path.join(root, "public", "bench");
const entries = listEntries(bench);

if (entries.length === 0) {
  console.log("0 published entries");
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n);
const kb = (bytes) => (bytes / 1024).toFixed(1);

console.log(`published entries (${entries.length}) — public/bench/`);
console.log(`${pad("id", 20)}${pad("date", 13)}${pad("label", 20)}KB`);
for (const e of entries)
  console.log(`${pad(e.id, 20)}${pad(e.date.slice(0, 10), 13)}${pad(e.label, 20)}${kb(e.bytes)}`);

const last = entries[entries.length - 1];
const prev = entries[entries.length - 2];
console.log(
  prev
    ? `default compare pair: ${prev.id} → ${last.id} (compare.html)`
    : "no default compare pair — two entries are needed (compare.html)",
);
