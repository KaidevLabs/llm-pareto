// 029: fresh build of a tree + provenance (HEAD sha, dirty flag, build stamp).
import { spawnSync } from "node:child_process";
import { existsSync, symlinkSync, readFileSync } from "node:fs";
import path from "node:path";

export function gitFacts(root) {
  const run = (args) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
    return r.stdout.trim();
  };
  return {
    head: run(["rev-parse", "HEAD"]),
    short: run(["rev-parse", "--short", "HEAD"]),
    dirty: run(["status", "--porcelain"]).length > 0,
  };
}

export function freshBuild(treeDir) {
  if (!existsSync(path.join(treeDir, "node_modules"))) {
    const nm = path.join(treeDir, "node_modules");
    try {
      symlinkSync(path.join(process.cwd(), "node_modules"), nm, "dir");
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  const t0 = Date.now();
  const r = spawnSync("npm", ["run", "build"], { cwd: treeDir, encoding: "utf8", maxBuffer: 32e6 });
  if (r.status !== 0) throw new Error(`npm run build failed in ${treeDir}:\n${r.stdout}\n${r.stderr}`);
  const dist = path.join(treeDir, "dist");
  if (!existsSync(dist)) throw new Error(`build produced no dist/ in ${treeDir}`);
  return { builtAt: new Date().toISOString(), ms: Date.now() - t0, dist, indexHtml: readFileSync(path.join(dist, "index.html"), "utf8") };
}
