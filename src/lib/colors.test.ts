import { describe, it, expect } from "vitest";
import { ORG_COLORS, ORG_FALLBACK, withAlpha, buildOrgColors } from "./colors";
import type { Row } from "./types";

const row = (arena_org: string): Row =>
  ({ or_name: "Org: Foo", arena_org, or_id: "org/foo" }) as Row;

// Characterization: values pinned from the real app.js functions
// (harness run 2026-09-18, plan 028 step 1).
describe("withAlpha", () => {
  it("converts hex to rgba", () => {
    expect(withAlpha("#58a6ff", 0.5)).toBe("rgba(88,166,255,0.5)");
  });
});

describe("buildOrgColors", () => {
  it("assigns palette slots by org frequency, fallback beyond the palette", () => {
    const rows: Row[] = [
      ...Array.from({ length: 3 }, () => row("z-ai")),
      ...Array.from({ length: 2 }, () => row("openai")),
      row("anthropic"),
    ];
    expect(buildOrgColors(rows)).toEqual({
      "z-ai": ORG_COLORS[0],
      openai: ORG_COLORS[1],
      anthropic: ORG_COLORS[2],
    });

    const many: Row[] = ORG_COLORS.map((_, i) => row("org" + i));
    many.push(row("org17"));
    const map = buildOrgColors(many);
    ORG_COLORS.forEach((c, i) => expect(map["org" + i]).toBe(c));
    expect(map["org17"]).toBe(ORG_FALLBACK);
  });
});
