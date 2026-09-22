import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readRegistry, writeRegistry, listEntries, removeEntry } from "./registry.mjs";

// Fixtures mirror publish's entryFrom shape (033 A11): hand-written, minimal.
const entryA = { id: "run-20260921-0252", date: "2026-09-21T00:54:20.674Z", label: "4d908ab (dirty)", side: "new", files: ["static.json", "report.html"] };
const entryB = { id: "run-20260922-2142", date: "2026-09-22T19:44:46.627Z", label: "013e1c8", side: "new", files: ["static.json", "report.html"] };
const STATIC = '{"ln":12}'; // 9 bytes
const REPORT = "<html></html>"; // 13 bytes

// A registry with its entry dirs on disk, seeded in the given order.
const seed = (bench: string, entries = [entryA, entryB]) => {
  writeRegistry(bench, entries);
  for (const e of entries) {
    const d = path.join(bench, e.id);
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, "static.json"), STATIC);
    writeFileSync(path.join(d, "report.html"), REPORT);
  }
};

let dir: string;
const fresh = () => {
  dir = mkdtempSync(path.join(tmpdir(), "bench-registry-"));
  return dir;
};
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("readRegistry", () => {
  it("returns [] when index.json is missing", () => {
    expect(readRegistry(fresh())).toEqual([]);
  });
});

describe("writeRegistry", () => {
  it("writes 2-space JSON + trailing newline — the byte shape publish writes", () => {
    const bench = fresh();
    writeRegistry(bench, [entryA]);
    expect(readFileSync(path.join(bench, "index.json"), "utf8")).toBe(JSON.stringify([entryA], null, 2) + "\n");
  });
  it("round-trips: what writeRegistry writes, readRegistry reads back", () => {
    const bench = fresh();
    writeRegistry(bench, [entryA, entryB]);
    expect(readRegistry(bench)).toEqual([entryA, entryB]);
  });
});

describe("listEntries", () => {
  it("lists entries in registry order with the entry dir's total bytes", () => {
    const bench = fresh();
    seed(bench);
    expect(listEntries(bench)).toEqual([
      { id: entryA.id, date: entryA.date, label: entryA.label, bytes: STATIC.length + REPORT.length },
      { id: entryB.id, date: entryB.date, label: entryB.label, bytes: STATIC.length + REPORT.length },
    ]);
  });
  it("lists nothing for a missing registry", () => {
    expect(listEntries(fresh())).toEqual([]);
  });
});

describe("removeEntry", () => {
  it("removes the entry dir + its row, leaving other entries untouched", () => {
    const bench = fresh();
    seed(bench);
    expect(removeEntry(bench, entryA.id)).toEqual(entryA);
    expect(readRegistry(bench)).toEqual([entryB]);
    expect(existsSync(path.join(bench, entryA.id))).toBe(false);
    expect(existsSync(path.join(bench, entryB.id))).toBe(true);
    expect(readFileSync(path.join(bench, entryB.id, "static.json"), "utf8")).toBe(STATIC);
  });
  it("unknown id throws and changes nothing on disk", () => {
    const bench = fresh();
    seed(bench);
    const before = readFileSync(path.join(bench, "index.json"), "utf8");
    expect(() => removeEntry(bench, "nope")).toThrow(/unknown entry id/);
    expect(readFileSync(path.join(bench, "index.json"), "utf8")).toBe(before);
    expect(existsSync(path.join(bench, entryA.id))).toBe(true);
    expect(existsSync(path.join(bench, entryB.id))).toBe(true);
  });
  it("removing the last entry is allowed — the registry goes empty", () => {
    const bench = fresh();
    seed(bench, [entryB]);
    expect(removeEntry(bench, entryB.id)).toEqual(entryB);
    expect(readRegistry(bench)).toEqual([]);
    expect(existsSync(path.join(bench, entryB.id))).toBe(false);
  });
});
