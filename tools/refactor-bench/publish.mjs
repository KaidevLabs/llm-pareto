// 033 step 1: publish a bench run into the committed registry (public/bench/)
// so the app's compare page can link to it. Usage:
//   node tools/refactor-bench/publish.mjs [run-dir]
// Without a run-dir: the latest run-* dir in ./benchmarks. Exits non-zero on
// any refusal (incomplete run, duplicate id).
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { publishRun } from "./lib/publish.mjs";

const root = process.cwd();
const arg = process.argv.slice(2).filter((a) => !a.startsWith("--"))[0];

let runDir;
if (arg) {
  runDir = path.resolve(arg);
} else {
  const benchDir = path.join(root, "benchmarks");
  const runs = existsSync(benchDir)
    ? readdirSync(benchDir).filter((n) => n.startsWith("run-") && statSync(path.join(benchDir, n)).isDirectory()).sort()
    : [];
  if (runs.length === 0) {
    console.error("[publish] no run dirs in benchmarks/ — pass one explicitly");
    process.exit(1);
  }
  runDir = path.join(benchDir, runs[runs.length - 1]);
}

try {
  const entry = publishRun(runDir, path.join(root, "public", "bench"));
  console.log(`[publish] ${entry.id} → public/bench/${entry.id}/ (${entry.label})`);
  console.log(`[publish] artifacts: ${entry.files.join(", ")}`);
  console.log("[publish] registry: public/bench/index.json");
} catch (e) {
  console.error(`[publish] FAILED: ${e.message}`);
  process.exit(1);
}
