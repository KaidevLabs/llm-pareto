// 033 A11: refactor-bench harness — one tree per run. Bare invocation measures
// the current tree; a positional <ref> measures that ref in a throwaway
// worktree (fairCopy keeps its data identical to the live tree's). Phases:
// static | coverage | load | interact | report. `--only a,b` runs a subset;
// phase artifacts already present in --out are reused (--force re-runs), so
// reports can be generated one phase at a time and combined afterwards.
// `--only report` needs no worktree/builds — it only merges existing JSONs.
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
// Positional ref parses AFTER every takeVal splice, so flag values (--out …,
// --work-dir …) never leak into it.
const ref = args.filter((a) => !a.startsWith("--"))[0] ?? null;
const treeDir = path.join(workDir, "tree");
const measuredRoot = ref ? treeDir : root;
const port = portBase;
const cdpPort = 9243 + (portBase - 8311);
const log = (...a) => console.log("[bench]", ...a);

const worktreeCleanup = () => {
  if (ref) {
    spawnSync("git", ["worktree", "remove", "--force", treeDir], { cwd: root, stdio: "ignore" });
    rmSync(treeDir, { recursive: true, force: true });
  }
  spawnSync("git", ["worktree", "prune"], { cwd: root, stdio: "ignore" });
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
let facts = null;
const meta = {
  startedAt: new Date().toISOString(),
  ref: null,
  live,
  runs,
  only: onlyRaw ?? "all",
  ports: { web: port, cdp: cdpPort },
  node: process.version,
  chromium: (() => { try { return spawnSync("chromium", ["--version"], { encoding: "utf8" }).stdout.trim().split("\n")[0]; } catch { return "unknown"; } })(),
};

try {
  if (needsMeasure) {
    worktreeCleanup();
    if (ref) {
      const r = spawnSync("git", ["worktree", "add", treeDir, ref], { cwd: root, encoding: "utf8" });
      if (r.status !== 0) throw new Error(`git worktree add ${treeDir} ${ref} failed:\n${r.stderr}`);
      log(`worktree at ${ref} → ${treeDir}`);
      // Facts BEFORE the fairness copy: fairCopy overwrites committed public/
      // data in the worktree, which git would otherwise read as tree dirt.
      facts = gitFacts(measuredRoot);
      log("fairness copy (current data/assets/fonts → tree/public/)…");
      await fairCopy(root, treeDir);
    } else {
      facts = gitFacts(measuredRoot);
    }
    meta.ref = facts.short;
  }

  if (needsBuild) {
    log(`fresh build (${ref ? `ref ${ref}` : "current tree"})…`);
    build = freshBuild(measuredRoot);
    meta.build = { builtAt: build.builtAt, ms: build.ms };
  }

  await mkdir(outDir, { recursive: true });

  if (needsMeasure) {
    const label = `${facts.short}${facts.dirty ? " (dirty)" : ""}`;
    const srcDir = path.join(measuredRoot, "src");
    const hasSrc = existsSync(srcDir);
    const side = {
      label,
      head: facts.short,
      root: measuredRoot,
      srcDir: hasSrc ? srcDir : null,
      appFiles: hasSrc ? [] : [path.join(measuredRoot, "public", "app.js")],
      clocTargets: hasSrc ? [srcDir] : [path.join(measuredRoot, "public", "app.js"), path.join(measuredRoot, "public", "index.html")],
      hasSvelte: hasSrc,
      scratch: workDir,
    };
    log(`measuring ${label}${ref ? ` (worktree @ ${ref})` : ""}`);

    if (want("static")) {
      log("static analysis…");
      await runPhase("static", async () => {
        const t = Date.now();
        const j = await staticAnalysis(side);
        const c = j.complexity;
        log(`  ${c.fileCount} files, ${c.lines} ln, ${c.functions} fns, cyclomatic Σ${c.cyclomatic} (${Date.now() - t}ms)`);
        return j;
      });
    }

    if (want("coverage")) {
      log("test coverage…");
      const cov = await runPhase("coverage", () => coverageAnalysis(side));
      if (cov.null) log(`  no coverage (${cov.note.split("\n")[0]})`);
      else log(`  ${cov.lines}% lines / ${cov.branches}% branches over ${cov.files} files`);
    }

    if (want("load")) {
      log("load timing…");
      await runPhase("load", () => loadAnalysis({ port, cdpPort, root: build.dist, label, live, runs }));
    }

    if (want("interact")) {
      log("interactions…");
      await runPhase("interact", () => interactAnalysis({ port, cdpPort, root: build.dist, label, hasSvelte: side.hasSvelte, repeats: runs }));
    }

    // Provenance describes the measuring run: rewritten on every measuring
    // phase so the build facts stay current; report-only merges read whatever
    // is on disk (and fail below if a dir has no provenance at all).
    const provPath = path.join(outDir, "provenance.json");
    await writeFile(provPath, JSON.stringify({
      ref: facts.short,
      dirty: facts.dirty,
      buildAt: build?.builtAt ?? null,
      nodeVersion: meta.node,
      chromiumVersion: meta.chromium,
      runs,
      runDate: new Date().toISOString(),
    }, null, 2));
  }

  if (want("report")) {
    const provPath = path.join(outDir, "provenance.json");
    const prov = existsSync(provPath)
      ? JSON.parse(readFileSync(provPath, "utf8"))
      : (() => { throw new Error(`provenance.json missing in ${outDir} — run a measuring phase first`); })();
    await reportAnalysis({ ...prov, outDir });
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
