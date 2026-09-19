// 031: standalone cyclomatic report for the current tree — `npm run cyc`.
// AST pass only (no cloc/jscpd/worktrees): reads src/, excludes tests, prints
// per-function + per-file offenders. Same method as the bench's static phase.
import path from "node:path";
import { appCorpus, complexityPass } from "./lib/static.mjs";

const root = process.cwd();
const srcDir = path.join(root, "src");
const { entries, fileLines } = await appCorpus(srcDir);
if (!entries.length) {
  console.error(`[cyc] no app sources under ${srcDir} — run from the repo root`);
  process.exit(1);
}

const c = complexityPass(entries);
const charts = c.files.filter((f) => /charts\.ts$/.test(f.name)).reduce((a, f) => a + f.cyclomatic, 0);
const pad = (s, n) => String(s).padEnd(n);

console.log(`cyclomatic — ${path.relative(root, srcDir)} (app only, tests excluded)`);
console.log(
  `files ${c.fileCount} · functions ${c.functions} · Σ cyc ${c.cyclomatic} · avg ${c.cyclomaticAvg}` +
    ` · max fn ${c.maxFunction} · max nest ${c.maxNesting} · any ${c.anyCount}` +
    (charts ? ` · charts.ts ${Math.round((charts / c.cyclomatic) * 1000) / 10}%` : ""),
);

console.log("\ntop functions by cyclomatic:");
for (const f of c.topFunctions) console.log(`  ${pad(f.cyc, 4)} nest ${pad(f.nest, 3)} ${f.name}  (${f.file})`);

console.log("\nfiles by cyclomatic:");
for (const f of c.files) console.log(`  ${pad(f.cyclomatic, 5)} fns ${pad(f.functions, 4)} ${f.name}`);

const longest = [...fileLines].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(`\nlongest files: ${longest.map(([n, l]) => `${n} (${l})`).join(", ")}`);
