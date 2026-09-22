import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateRun, entryFrom, publishRun } from "./publish.mjs";

// Fixtures: hand-written, minimal — never real page snapshots (AGENTS.md).
// Provenance shape per 033 A11: one measured tree per run.
const provClean = {
  ref: "e858d24",
  dirty: false,
  buildAt: null,
  nodeVersion: "v26.8.2",
  chromiumVersion: "Chromium 153.0.8010.36 Arch Linux",
  runs: 1,
  runDate: "2026-09-19T21:46:19.064Z",
};
// Pre-rework two-ref provenance (031 schema): unpublishable — its run JSONs
// carry {old, new} shapes the registry must not mix.
const provTwoRef = { refA: "7957602", refB: "e858d24", headShort: "1f215f2", runDate: "2026-09-19T21:46:19.064Z" };

let dir: string;
const fresh = () => {
  dir = mkdtempSync(path.join(tmpdir(), "bench-publish-"));
  return dir;
};
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("validateRun", () => {
  it("accepts a dir with static.json and provenance.json", () => {
    const run = fresh();
    writeFileSync(path.join(run, "static.json"), "{}");
    writeFileSync(path.join(run, "provenance.json"), JSON.stringify(provClean));
    expect(validateRun(run)).toEqual({ ok: true });
  });
  it("rejects a dir missing static.json, naming it", () => {
    const run = fresh();
    writeFileSync(path.join(run, "provenance.json"), "{}");
    const r = validateRun(run);
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toContain("static.json");
  });
  it("rejects a dir missing provenance.json, naming it", () => {
    const run = fresh();
    writeFileSync(path.join(run, "static.json"), "{}");
    const r = validateRun(run);
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toContain("provenance.json");
  });
});

// The entry's label names the measured tree: the run's resolved ref, with a
// dirty marker for bare runs against an uncommitted tree (A11).
describe("entryFrom", () => {
  it("derives id/date/label/side from a clean run", () => {
    const run = fresh();
    writeFileSync(path.join(run, "provenance.json"), JSON.stringify(provClean));
    expect(entryFrom(run, provClean)).toEqual({
      id: path.basename(run),
      date: "2026-09-19T21:46:19.064Z",
      label: "e858d24",
      side: "new",
      files: ["provenance.json"],
    });
  });
  it("marks a dirty bare run in the label", () => {
    const run = fresh();
    writeFileSync(path.join(run, "provenance.json"), JSON.stringify({ ...provClean, ref: "f7b9b93", dirty: true }));
    expect(entryFrom(run, { ...provClean, ref: "f7b9b93", dirty: true }).label).toBe("f7b9b93 (dirty)");
  });
  it("refuses pre-rework two-ref provenance (no ref field)", () => {
    const run = fresh();
    writeFileSync(path.join(run, "provenance.json"), JSON.stringify(provTwoRef));
    expect(() => entryFrom(run, provTwoRef)).toThrow(/ref/);
  });
  it("lists only present artifacts, in canonical order", () => {
    const run = fresh();
    writeFileSync(path.join(run, "provenance.json"), "{}");
    writeFileSync(path.join(run, "load.json"), "{}");
    writeFileSync(path.join(run, "static.json"), "{}");
    writeFileSync(path.join(run, "meta.json"), "{}"); // run-local, not an entry artifact
    writeFileSync(path.join(run, "report.md"), "{}"); // run-local, not an entry artifact
    expect(entryFrom(run, provClean).files).toEqual(["static.json", "load.json", "provenance.json"]);
  });
});

const fullRun = () => {
  const run = fresh();
  for (const [f, body] of [["static.json", '{"ln":1}'], ["provenance.json", JSON.stringify(provClean)], ["report.html", "<html>"]])
    writeFileSync(path.join(run, f), body);
  return run;
};

describe("publishRun", () => {
  it("copies artifacts verbatim and creates the registry when missing", () => {
    const run = fullRun();
    const bench = path.join(fresh(), "bench");
    const entry = publishRun(run, bench);
    expect(readFileSync(path.join(bench, entry.id, "static.json"), "utf8")).toBe('{"ln":1}');
    expect(readFileSync(path.join(bench, entry.id, "report.html"), "utf8")).toBe("<html>");
    const reg = JSON.parse(readFileSync(path.join(bench, "index.json"), "utf8"));
    expect(reg).toEqual([entry]);
  });
  it("appends to an existing registry", () => {
    const first = fullRun();
    const second = fullRun();
    const bench = path.join(fresh(), "bench");
    publishRun(first, bench);
    publishRun(second, bench);
    const reg = JSON.parse(readFileSync(path.join(bench, "index.json"), "utf8"));
    expect(reg.map((e) => e.id)).toEqual([path.basename(first), path.basename(second)]);
  });
  it("refuses a duplicate id, registry unchanged", () => {
    const run = fullRun();
    const bench = path.join(fresh(), "bench");
    publishRun(run, bench);
    const before = readFileSync(path.join(bench, "index.json"), "utf8");
    expect(() => publishRun(run, bench)).toThrow(/duplicate/);
    expect(readFileSync(path.join(bench, "index.json"), "utf8")).toBe(before);
  });
  it("refuses an incomplete run, writing nothing", () => {
    const run = fresh();
    writeFileSync(path.join(run, "meta.json"), "{}");
    const bench = path.join(fresh(), "bench");
    expect(() => publishRun(run, bench)).toThrow(/incomplete/);
    expect(existsSync(bench)).toBe(false);
  });
});
