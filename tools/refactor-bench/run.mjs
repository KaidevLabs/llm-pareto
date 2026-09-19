// 031 A1: two-ref refactor-bench harness — committed repo tool, zero app deps.
// Phases: static | coverage | load | interact | report. `--only a,b` runs a
// subset; phase artifacts already present in --out are reused (--force re-runs),
// so reports can be generated one phase at a time and combined afterwards.
// `--only report` needs no worktrees/builds — it only merges existing JSONs.
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freshBuild, gitFacts } from "./lib/build.mjs";
import { fairCopy } from "./lib/fair.mjs";
import { staticAnalysis } from "./lib/static.mjs";
import { loadAnalysis } from "./lib/load.mjs";
import { interactAnalysis } from "./lib/interact.mjs";
import { reportAnalysis } from "./lib/report.mjs";
import { coverageAnalysis } from "./lib/coverage.mjs";
import { genPage } from "./lib/page.mjs";

const args = process.argv.slice(2);
const takeFlag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};
const takeNum = (name, dflt) => {
  const i = args.indexOf(name);
  if (i === -1) return dflt;
  const v = Number(args[i + 1]);
  args.splice(i, 2);
  return Number.isFinite(v) ? v : dflt;
};
const takeVal = (name, dflt) => {
  const i = args.indexOf(name);
  if (i === -1) return dflt;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) return dflt;
  args.splice(i, 2);
  return v;
};
const single = takeFlag("--single");
const live = takeFlag("--live");
const runs = takeNum("--runs", 7);
const portBase = takeNum("--port-base", 8311);
const onlyRaw = takeVal("--only", null);
const force = takeFlag("--force");
const want = (p) => !onlyRaw || onlyRaw.split(",").map((s) => s.trim()).includes(p);
const needsMeasure = ["static", "coverage", "load", "interact"].some(want);
const needsBuild = want("load") || want("interact");

const root = process.cwd();
const bench = path.dirname(fileURLToPath(import.meta.url));
const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};
const workDir = takeVal("--work-dir", path.join(bench, ".run"));
const outDir = takeVal("--out", path.join(root, "benchmarks", `run-${stamp()}`));
// Positional refs parse AFTER every takeVal splice, so flag values (--out …,
// --work-dir …) never leak into the ref list.
const positional = args.filter((a) => !a.startsWith("--"));
const oldDir = path.join(workDir, "old");
const refA = positional[0] ?? "7957602";
const refB = positional[1] ?? "e858d24";
const newDir = refB ? path.join(workDir, "new") : root;
const ports = { old: portBase, neu: portBase + 1, cdp: 9243 + (portBase - 8311) };
const log = (...a) => console.log("[bench]", ...a);

const worktreeCleanup = () => {
  if (!single) {
    spawnSync("git", ["worktree", "remove", "--force", oldDir], { cwd: root, stdio: "ignore" });
    rmSync(oldDir, { recursive: true, force: true });
  }
  if (refB) {
    spawnSync("git", ["worktree", "remove", "--force", newDir], { cwd: root, stdio: "ignore" });
    rmSync(newDir, { recursive: true, force: true });
  }
  spawnSync("git", ["worktree", "prune"], { cwd: root, stdio: "ignore" });
};

const worktreeAdd = (ref, dir) => {
  const r = spawnSync("git", ["worktree", "add", dir, ref], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git worktree add ${dir} ${ref} failed:\n${r.stderr}`);
};

// A phase = one result JSON in outDir. Existing artifact → reuse (--force re-runs),
// so phases can be generated one at a time into the same run dir and combined later.
const runPhase = async (name, fn) => {
  const f = path.join(outDir, `${name}.json`);
  if (!force && existsSync(f)) {
    log(`${name}: reusing existing ${name}.json (--force re-runs)`);
    return JSON.parse(readFileSync(f, "utf8"));
  }
  const v = await fn();
  await writeFile(f, JSON.stringify(v, null, 2));
  log(`results/${name}.json written`);
  return v;
};

const t0 = Date.now();
let exitCode = 0;
let build = null;
const meta = {
  startedAt: new Date().toISOString(),
  refs: { refA, refB: refB ?? "current tree" },
  single,
  live,
  runs,
  only: onlyRaw ?? "all",
  ports,
  node: process.version,
  chromium: (() => { try { return spawnSync("chromium", ["--version"], { encoding: "utf8" }).stdout.trim().split("\n")[0]; } catch { return "unknown"; } })(),
};

try {
  const prov = gitFacts(root);
  meta.head = prov.head;
  meta.short = prov.short;
  meta.dirty = prov.dirty;

  if (needsMeasure) {
    worktreeCleanup();
    if (!single) worktreeAdd(refA, oldDir);
    if (refB) worktreeAdd(refB, newDir);
  }

  if (needsBuild) {
    if (!single) {
      log("fairness copy (current data/assets/fonts → old/public/)…");
      await fairCopy(root, oldDir);
      if (refB) await fairCopy(root, newDir);
    }
    log(`fresh build (${refB ? `new @ ${refB}` : "current tree"})…`);
    build = freshBuild(newDir);
    meta.build = { builtAt: build.builtAt, ms: build.ms };
  }

  await mkdir(outDir, { recursive: true });

  const sides = [];
  if (needsMeasure && !single) {
    const oldSrc = path.join(oldDir, "src");
    const hasOldSrc = existsSync(oldSrc);
    sides.push({
      key: "old",
      label: `old @ ${refA}`,
      head: refA,
      root: oldDir,
      srcDir: hasOldSrc ? oldSrc : null,
      appFiles: hasOldSrc ? [] : [path.join(oldDir, "public", "app.js")],
      clocTargets: hasOldSrc ? [oldSrc] : [path.join(oldDir, "public", "app.js"), path.join(oldDir, "public", "index.html")],
      hasSvelte: hasOldSrc,
      scratch: workDir,
    });
  }
  if (needsMeasure) {
    const newSrc = path.join(newDir, "src");
    sides.push({
      key: "new",
      label: refB ? `new @ ${refB}` : `current tree @ ${prov.short}`,
      head: refB ?? prov.short,
      root: newDir,
      srcDir: newSrc,
      appFiles: [],
      clocTargets: [newSrc],
      hasSvelte: existsSync(newSrc),
      scratch: workDir,
    });
  }

  if (want("static")) {
    log("static analysis…");
    await runPhase("static", async () => {
      const j = {};
      for (const side of sides) {
        const t = Date.now();
        j[side.key] = await staticAnalysis(side);
        const c = j[side.key].complexity;
        log(`  ${side.key}: ${c.fileCount} files, ${c.lines} ln, ${c.functions} fns, cyclomatic Σ${c.cyclomatic} (${Date.now() - t}ms)`);
      }
      return j;
    });
  }

  if (want("coverage")) {
    log("test coverage…");
    const coverageJson = await runPhase("coverage", () => coverageAnalysis(sides));
    for (const [k, v] of Object.entries(coverageJson)) {
      if (v.null) log(`  ${k}: no coverage (${v.note.split("\n")[0]})`);
      else log(`  ${k}: ${v.lines}% lines / ${v.branches}% branches over ${v.files} files`);
    }
  }

  if (want("load")) {
    log("load timing…");
    await runPhase("load", () => loadAnalysis({
      ports,
      oldRoot: single ? null : path.join(oldDir, "public"),
      newRoot: build.dist,
      refA,
      newLabel: refB ? `new @ ${refB}` : `current tree @ ${prov.short}`,
      live,
      runs,
    }));
  }

  if (want("interact")) {
    log("interactions…");
    await runPhase("interact", () => interactAnalysis({
      ports,
      oldRoot: single ? null : path.join(oldDir, "public"),
      newRoot: build.dist,
      refA,
      newLabel: refB ? `new @ ${refB}` : `current tree @ ${prov.short}`,
      repeats: runs,
    }));
  }

  // Provenance describes the measuring run: rewritten whenever a measuring phase
  // runs; reused for report-only merges so the original build facts survive.
  const provPath = path.join(outDir, "provenance.json");
  const provOut = needsMeasure || !existsSync(provPath)
    ? {
        refA,
        refB: refB ?? "current tree",
        headShort: meta.short,
        dirty: meta.dirty,
        buildAt: build?.builtAt ?? null,
        nodeVersion: meta.node,
        chromiumVersion: meta.chromium,
        runs,
        runDate: new Date().toISOString(),
      }
    : JSON.parse(readFileSync(provPath, "utf8"));
  await writeFile(provPath, JSON.stringify(provOut, null, 2));

  if (want("report")) {
    await reportAnalysis({ ...provOut, outDir });
    log(`results/report.md written`);
    const pagePath = await genPage(outDir);
    log(`results/report.html written (${pagePath})`);
  }
  if (live) log("--live requested: prod target joins the load module");
} catch (e) {
  exitCode = 1;
  console.error("[bench] FAILED:", e.message);
} finally {
  worktreeCleanup();
  meta.ms = Date.now() - t0;
  await mkdir(outDir, { recursive: true }).catch(() => {});
  await writeFile(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2)).catch(() => {});
  log(`done in ${Math.round(meta.ms / 1000)}s — worktree cleaned`);
}
process.exit(exitCode);
