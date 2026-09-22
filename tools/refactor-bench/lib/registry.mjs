// 042: the published bench registry (public/bench/index.json + one dir per
// entry) — the single owner of the index.json contract. publish (033),
// bench:ls and bench:rm agree by construction.
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from "node:fs";
import path from "node:path";

const regPath = (benchRoot) => path.join(benchRoot, "index.json");

// The registry is a plain JSON list; a missing index.json is an empty
// registry, not an error (publish creates it on first publish).
export function readRegistry(benchRoot) {
  const p = regPath(benchRoot);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : [];
}

// The exact byte shape publish has always written: 2-space JSON + trailing
// newline, so a registry written by publish and by rm is byte-identical.
export function writeRegistry(benchRoot, entries) {
  writeFileSync(regPath(benchRoot), JSON.stringify(entries, null, 2) + "\n");
}

// One row per entry, in registry (append) order; bytes = the entry dir's
// total file size — the ≈44 KB the compare page serves per entry.
export function listEntries(benchRoot) {
  return readRegistry(benchRoot).map((e) => ({ id: e.id, date: e.date, label: e.label, bytes: entryBytes(benchRoot, e.id) }));
}

// Remove one entry: its dir + its registry row. Unknown id throws before
// anything is touched; removing the last entry is allowed (the compare page
// renders its "two are needed" state — the page is the guard, 042 D3).
export function removeEntry(benchRoot, id) {
  const entries = readRegistry(benchRoot);
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw new Error(`unknown entry id: ${id}`);
  rmSync(path.join(benchRoot, id), { recursive: true, force: true });
  writeRegistry(benchRoot, entries.filter((e) => e.id !== id));
  return entry;
}

function entryBytes(benchRoot, id) {
  const dir = path.join(benchRoot, id);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce((sum, n) => {
    const p = path.join(dir, n);
    return statSync(p).isFile() ? sum + statSync(p).size : sum;
  }, 0);
}
