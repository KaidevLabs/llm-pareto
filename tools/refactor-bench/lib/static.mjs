// 029 A3: static analysis — cloc (npx), AST complexity pass (repo TS), jscpd (npx), crude counts.
import { spawnSync } from "node:child_process";
import { readdir, readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".tmp", ".wrangler", ".wrangler-obsolete"]);

async function listFiles(dir, exts, skip = []) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !skip.includes(e.name)) out.push(...(await listFiles(p, exts, skip)));
    } else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

const extractScripts = (text) =>
  [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

function runNpx(pkg, args, label) {
  const r = spawnSync("npx", ["--yes", pkg, ...args], { encoding: "utf8", maxBuffer: 64e6 });
  if (r.status !== 0) throw new Error(`${label} (npx ${pkg}) failed:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

function clocJson(targets, { forceSvelte = false, exclude = null } = {}) {
  const extra = [
    ...(exclude ? ["--not-match-f", exclude] : []),
    ...(forceSvelte ? ["--force-lang=JavaScript,svelte"] : []),
  ];
  const out = runNpx("cloc", ["--quiet", "--json", ...extra, ...targets], "cloc");
  const start = out.indexOf("{");
  return JSON.parse(out.slice(start, out.lastIndexOf("}") + 1));
}

function jscpdDir(targets, outDir) {
  runNpx("jscpd", ["--min-tokens", "50", "--reporters", "json", "--output", outDir, "--silent", ...targets], "jscpd");
  const report = path.join(outDir, "jscpd-report.json");
  if (!existsSync(report)) throw new Error(`jscpd produced no report at ${report}`);
  return readJson(report);
}

const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

function fnDisplayName(node, scope) {
  const text = (n) => (n && n.getText ? n.getText() : null) || null;
  const declared = ["name", "text"].map((k) => (node[k] ? text(node[k]) : null)).find(Boolean);
  if (declared) return declared;
  return scope || "anonymous";
}

export function complexityPass(entries) {
  const files = [];
  const anyFiles = [];
  const topFns = [];
  for (const e of entries) {
    const sf = ts.createSourceFile(e.name, e.text, ts.ScriptTarget.Latest, true);
    let funcs = 0, cyc = 0, maxFn = 0, maxNest = 0, anyCount = 0;
    const fnStack = [];
    const nameStack = [];
    const text = (n) => (n && n.getText ? n.getText() : null) || null;
    const scopeName = (node) => {
      if (node.name && (node.kind === ts.SyntaxKind.VariableDeclaration || node.kind === ts.SyntaxKind.PropertyAssignment || node.kind === ts.SyntaxKind.MethodDeclaration || node.kind === ts.SyntaxKind.FunctionDeclaration || node.kind === ts.SyntaxKind.PropertyDeclaration || node.kind === ts.SyntaxKind.GetAccessor || node.kind === ts.SyntaxKind.SetAccessor)) return text(node.name);
      if (node.kind === ts.SyntaxKind.BinaryExpression && node.left) return text(node.left);
      return null;
    };
    const visit = (node, depth, parent, scope) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) anyCount++;
      if (depth > maxNest) maxNest = depth;
      const nextScope = scopeName(node) ?? scope;
      const isFn =
        ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
      if (isFn) {
        fnStack.push(1);
        nameStack.push(fnDisplayName(node, scope));
      }
      if (fnStack.length > 0) {
        let w = 0;
        if (ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isCaseClause(node) || ts.isCatchClause(node)) w = 1;
        else if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) w = 1;
        else if (ts.isBinaryExpression(node)) {
          const op = node.operatorToken.kind;
          if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) w = 1;
        }
        if (w) fnStack[fnStack.length - 1] += w;
      }
      ts.forEachChild(node, (c) => visit(c, depth + 1, node, nextScope));
      if (isFn) {
        const v = fnStack.pop();
        const fname = nameStack.pop();
        funcs++;
        cyc += v;
        topFns.push({ file: e.name, name: fname, cyc: v, nest: depth });
        if (v > maxFn) maxFn = v;
      }
    };
    visit(sf, 0, null, null);
    const lines = e.text.split("\n").length;
    if (anyCount > 0) anyFiles.push([e.name, anyCount]);
    files.push({ name: e.name, lines, functions: funcs, cyclomatic: cyc, maxFunction: maxFn, maxNesting: maxNest, anyCount });
  }
  const tot = files.reduce(
    (s, f) => ({
      lines: s.lines + f.lines,
      functions: s.functions + f.functions,
      cyclomatic: s.cyclomatic + f.cyclomatic,
      maxFunction: Math.max(s.maxFunction, f.maxFunction),
      maxNesting: Math.max(s.maxNesting, f.maxNesting),
      anyCount: s.anyCount + f.anyCount,
    }),
    { lines: 0, functions: 0, cyclomatic: 0, maxFunction: 0, maxNesting: 0, anyCount: 0 },
  );
  return {
    fileCount: files.length,
    ...tot,
    cyclomaticAvg: tot.functions ? Math.round((tot.cyclomatic / tot.functions) * 10) / 10 : null,
    files: files.sort((a, b) => b.cyclomatic - a.cyclomatic).slice(0, 15),
    topFunctions: topFns.sort((a, b) => b.cyc - a.cyc).slice(0, 15),
    anyFiles,
  };
}

async function testCounts(testsRoot) {
  const testFiles = await listFiles(testsRoot, [".test.ts", ".test.js", ".test.mjs", ".spec.ts", ".spec.js", ".spec.mjs"]);
  let describes = 0, cases = 0;
  for (const p of testFiles) {
    const text = await readFile(p, "utf8");
    describes += (text.match(/\bdescribe\s*\(/g) ?? []).length;
    cases += (text.match(/\b(?:it|test)\s*\(/g) ?? []).length;
  }
  const pyDir = path.join(testsRoot, "tests");
  const pyFiles = (await listFiles(pyDir, [".py"])).filter((p) => path.basename(p).startsWith("test_")).length;
  return { js: { files: testFiles.length, describes, cases }, python: { files: pyFiles } };
}

function clocSummary(cloc) {
  const langs = {};
  let total = null;
  for (const [k, v] of Object.entries(cloc)) {
    if (k === "summary" || k === "header") continue;
    if (k === "SUM") {
      total = { files: v.nFiles, code: v.code, comment: v.comment, blank: v.blank };
      continue;
    }
    langs[k] = { files: v.nFiles, code: v.code, comment: v.comment, blank: v.blank };
  }
  return { languages: langs, total };
}

// App-code corpus for the AST pass: .ts files + .svelte <script> bodies, tests
// excluded. Shared by staticAnalysis (bench) and the standalone cyc CLI. When
// `corpusDir` is given the corpus is mirrored to disk for jscpd.
export async function appCorpus(srcDir, corpusDir = null) {
  const entries = [];
  const fileLines = [];
  if (corpusDir) {
    await rm(corpusDir, { recursive: true, force: true });
    await mkdir(corpusDir, { recursive: true });
  }
  const files = await listFiles(srcDir, [".ts", ".svelte"]);
  for (const p of files) {
    const rel = path.relative(srcDir, p).replaceAll("/", "__");
    const display = `src/${path.relative(srcDir, p)}`;
    const text = await readFile(p, "utf8");
    if (/\.test\.ts$/.test(p) || p.endsWith("test-setup.ts")) continue;
    if (p.endsWith(".svelte")) {
      fileLines.push([`${display} (raw)`, text.split("\n").length]);
      const script = extractScripts(text);
      if (script.trim()) {
        entries.push({ name: `${display}#script`, text: script });
        if (corpusDir) await writeFile(path.join(corpusDir, `svelte__${rel}.ts`), script);
      }
    } else {
      fileLines.push([display, text.split("\n").length]);
      entries.push({ name: display, text });
      if (corpusDir) await cp(p, path.join(corpusDir, `ts__${rel}`));
    }
  }
  return { entries, fileLines };
}

export async function staticAnalysis(side) {
  for (const t of side.clocTargets) if (!existsSync(t)) throw new Error(`cloc target missing: ${t}`);
  const clocSubs = [];
  const clocOpts = { exclude: side.srcDir ? "\\.test\\.ts$|test-setup\\.ts$" : null };
  let cloc = clocJson(side.clocTargets, clocOpts);
  if (side.hasSvelte && !cloc.Svelte) {
    cloc = clocJson(side.clocTargets, { ...clocOpts, forceSvelte: true });
    clocSubs.push("svelte not recognized by cloc — forced to JavaScript (template+style counted as JS lines)");
  }

  const tmpCorpus = path.join(side.scratch, `jscpd-corpus-${side.key}`);
  let entries, fileLines;
  if (side.srcDir && existsSync(side.srcDir)) {
    ({ entries, fileLines } = await appCorpus(side.srcDir, tmpCorpus));
  } else {
    await rm(tmpCorpus, { recursive: true, force: true });
    await mkdir(tmpCorpus, { recursive: true });
    entries = [];
    fileLines = [];
    for (const p of side.appFiles) {
      const text = await readFile(p, "utf8");
      entries.push({ name: p, text });
      fileLines.push([p, text.split("\n").length]);
      await cp(p, path.join(tmpCorpus, path.basename(p)));
    }
  }

  const complexity = complexityPass(entries);
  const dupRaw = await jscpdDir([tmpCorpus], path.join(side.scratch, `jscpd-${side.key}`));
  const tot = dupRaw?.statistics?.total ?? {};
  const tests = await testCounts(side.root);

  return {
    label: side.label,
    head: side.head,
    cloc: { ...clocSummary(cloc), substitutions: clocSubs },
    complexity,
    duplication: {
      percent: tot.percentage ?? null,
      percentTokens: tot.percentageTokens ?? null,
      duplicatedLines: tot.duplicatedLines ?? null,
      lines: tot.lines ?? null,
      clones: tot.clones ?? null,
    },
    longestFiles: fileLines.sort((a, b) => b[1] - a[1]).slice(0, 5),
    tests,
    notes: [
      "escomplex (npx) rejected: escomplex / typhonjs-escomplex / typhonjs-escomplex-project ship no CLI (npx: 'could not determine executable') and their 2015-era parsers cannot read TypeScript; substituted an in-module cyclomatic/nesting/any pass over ASTs from the repo's own TypeScript compiler — same method both sides.",
      "complexity + cloc corpora are app code only (tests excluded both sides, reported separately); svelte templates are measured as raw file lines but not complexity-scored.",
    ],
  };
}
