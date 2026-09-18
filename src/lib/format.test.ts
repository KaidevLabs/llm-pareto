import { describe, it, expect } from "vitest";
import { fmtPrice, fmtVotes, fmtToks, fmtMs, esc, median } from "./format";

// Characterization: values pinned from the real app.js functions
// (harness run 2026-09-18, plan 028 step 1).
describe("fmtPrice", () => {
  it("formats the full price ladder", () => {
    expect(fmtPrice(null)).toBe("—");
    expect(fmtPrice(0)).toBe("$0");
    expect(fmtPrice(0.001)).toBe("$0.0010");
    expect(fmtPrice(0.0095)).toBe("$0.0095");
    expect(fmtPrice(0.05)).toBe("$0.050");
    expect(fmtPrice(0.6)).toBe("$0.600");
    expect(fmtPrice(1)).toBe("$1.00");
    expect(fmtPrice(1.5)).toBe("$1.50");
    expect(fmtPrice(9.999)).toBe("$10.00");
    expect(fmtPrice(10)).toBe("$10");
    expect(fmtPrice(49.9)).toBe("$50");
    expect(fmtPrice(1234.56)).toBe("$1235");
  });
});

describe("fmtVotes", () => {
  it("abbreviates thousands, keeps smaller values", () => {
    expect(fmtVotes(null)).toBe("—");
    expect(fmtVotes(0)).toBe("0");
    expect(fmtVotes(999)).toBe("999");
    expect(fmtVotes(1000)).toBe("1k");
    expect(fmtVotes(1499)).toBe("1k");
    expect(fmtVotes(1500)).toBe("2k");
    expect(fmtVotes(24190)).toBe("24k");
  });
});

describe("fmtToks", () => {
  it("integers from 10 up, one decimal below", () => {
    expect(fmtToks(null)).toBe("—");
    expect(fmtToks(0)).toBe("0");
    expect(fmtToks(9.94)).toBe("9.9");
    expect(fmtToks(9.96)).toBe("10");
    expect(fmtToks(18)).toBe("18");
    expect(fmtToks(81)).toBe("81");
  });
});

describe("fmtMs", () => {
  it("ms below 1s, seconds with .0 trimmed above", () => {
    expect(fmtMs(null)).toBe("—");
    expect(fmtMs(489)).toBe("489ms");
    expect(fmtMs(949)).toBe("949ms");
    expect(fmtMs(999.6)).toBe("1000ms");
    expect(fmtMs(1000)).toBe("1s");
    expect(fmtMs(3100)).toBe("3.1s");
  });
});

describe("esc", () => {
  it("escapes markup-significant characters, coerces via String", () => {
    expect(esc('a<b>&"c')).toBe("a&lt;b&gt;&amp;&quot;c");
    expect(esc(5)).toBe("5");
    expect(esc(null)).toBe("null");
  });
});

describe("median", () => {
  it("drops non-finite values, interpolates even counts", () => {
    expect(median([])).toBe(null);
    expect(median([3])).toBe(3);
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([null, 2, NaN, 4, Infinity, 1])).toBe(2);
  });
});
