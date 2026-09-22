// 033 step 1: publish logic — validate a bench run, derive its registry
// entry, copy its artifacts verbatim into public/bench/ (A6/A7/A10).
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Artifacts an entry carries, verbatim from the run dir (A10). meta.json and
// report.md stay run-local — the registry entry and report.html carry what
// the compare page needs.
export const ARTIFACTS = [
  "static.json",
  "coverage.json",
  "load.json",
  "interact.json",
  "provenance.json",
  "report.html",
];

// The entry's label names the measured tree (A11): the run's resolved ref,
// with a dirty marker for bare runs against an uncommitted tree.
export function entryFrom(runDir, prov) {
  if (!prov.ref) throw new Error("provenance.json has no 'ref' — pre-rework two-ref run, re-measure with the current harness");
  return {
    id: path.basename(runDir),
    date: prov.runDate,
    label: `${prov.ref}${prov.dirty ? " (dirty)" : ""}`,
    side: "new",
    files: ARTIFACTS.filter((f) => existsSync(path.join(runDir, f))),
  };
}

// Publish one run into the committed registry (A6/A8): validate first, then
// check the registry — only a fully validated, non-duplicate entry touches
// the filesystem. Artifacts are copied verbatim (A10).
export function publishRun(runDir, benchRoot) {
  const check = validateRun(runDir);
  if (!check.ok) throw new Error(check.error);
  const prov = JSON.parse(readFileSync(path.join(runDir, "provenance.json"), "utf8"));
  const entry = entryFrom(runDir, prov);
  const regPath = path.join(benchRoot, "index.json");
  const registry = existsSync(regPath) ? JSON.parse(readFileSync(regPath, "utf8")) : [];
  if (registry.some((e) => e.id === entry.id)) throw new Error(`duplicate entry id: ${entry.id}`);
  const entryDir = path.join(benchRoot, entry.id);
  mkdirSync(entryDir, { recursive: true });
  for (const f of entry.files) copyFileSync(path.join(runDir, f), path.join(entryDir, f));
  writeFileSync(regPath, JSON.stringify([...registry, entry], null, 2) + "\n");
  return entry;
}
// The no-junk gate (033 overview): a publishable run has at least its static
// analysis and provenance. Anything less is a partial run → refuse.
export function validateRun(runDir) {
  const missing = ["static.json", "provenance.json"].filter((f) => !existsSync(path.join(runDir, f)));
  return missing.length === 0
    ? { ok: true }
    : { ok: false, error: `incomplete run: missing ${missing.join(", ")}` };
}

