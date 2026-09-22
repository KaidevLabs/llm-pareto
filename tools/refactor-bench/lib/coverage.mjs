// 031 A4/coverage: vitest coverage via `coverage-summary.json` for the one
// measured tree (033 A11). A tree without test infra (e.g. the vanilla ref)
// yields null + note and never aborts the harness — that absence is itself a
// finding ("refactor added a test suite").
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

function runCoverage(root) {
  rmSync(path.join(root, "coverage"), { recursive: true, force: true });
  const r = spawnSync(
    "npm",
    ["test", "--", "--coverage", "--run", "--root", ".", "--coverage.reporter=json-summary"],
    { cwd: root, encoding: "utf8", maxBuffer: 64e6 },
  );
  const summaryPath = path.join(root, "coverage", "coverage-summary.json");
  if (!existsSync(summaryPath)) {
    const log = (r.stderr || r.stdout || "").trim();
    const tail = log.split("\n").slice(-4).join(" ").trim() || `npm exit ${r.status}`;
    let reason = "no coverage summary produced";
    if (/Missing script: "test"|command not found|not found/.test(log)) reason = "no test script / no vitest at ref";
    else if (/coverage|Cannot find module|@vitest\/coverage/.test(log)) reason = "vitest coverage provider (@vitest/coverage-v8) not installed at ref";
    return { ok: false, note: `${reason} (${tail})` };
  }
  try {
    const s = JSON.parse(readFileSync(summaryPath, "utf8"));
    const tot = s.total || {};
    const pct = (o) => (o && typeof o.pct === "number" ? o.pct : null);
    const fileCount = Object.keys(s).filter((k) => k !== "total").length;
    return {
      ok: true,
      lines: pct(tot.lines),
      branches: pct(tot.branches),
      functions: pct(tot.functions),
      statements: pct(tot.statements),
      files: fileCount,
    };
  } catch (e) {
    return { ok: false, note: `coverage summary unreadable: ${e.message}` };
  }
}

export function coverageAnalysis(side) {
  try {
    const res = runCoverage(side.root);
    return res.ok
      ? { label: side.label, head: side.head, lines: res.lines, branches: res.branches, functions: res.functions, statements: res.statements, files: res.files }
      : { label: side.label, head: side.head, null: true, note: res.note };
  } catch (e) {
    return { label: side.label, head: side.head, null: true, note: `coverage crashed: ${e.message}` };
  } finally {
    // Vitest, when run inside a worktree whose node_modules resolves to the
    // harness root, can also emit a coverage/ at the harness cwd (the dev
    // tree, not the ref). That artifact is never the intended output (the
    // measured tree's summary lives in <side.root>/coverage) — drop it unless
    // the run targets the cwd itself (a bare run against the current tree).
    const legit = path.resolve(side.root, "coverage");
    const stray = path.resolve(process.cwd(), "coverage");
    if (existsSync(stray) && path.resolve(stray) !== legit) rmSync(stray, { recursive: true, force: true });
  }
}
