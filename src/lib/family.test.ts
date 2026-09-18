import { describe, it, expect } from "vitest";
import { orgOf, displayName, familyOf } from "./family";
import type { Row } from "./types";

const row = (or_name: string, arena_org = "", or_id = "x/y"): Row =>
  ({ or_name, arena_org, or_id } as Row);

// Characterization: values pinned from the real app.js functions
// (harness run 2026-09-18, plan 028 step 1).
describe("orgOf", () => {
  it("prefers the arena org, falls back to the or_id prefix", () => {
    expect(orgOf(row("", "OpenAI", "openai/gpt-5"))).toBe("OpenAI");
    expect(orgOf(row("", "  ", "z-ai/glm-5"))).toBe("z-ai");
    expect(orgOf(row("", "", "nocomp"))).toBe("nocomp");
  });
});

describe("displayName", () => {
  it("strips the org prefix and parentheticals", () => {
    expect(displayName(row("Anthropic: Claude Fable 5"))).toBe("Claude Fable 5");
    expect(displayName(row("Z.AI: GLM-5 (0414)"))).toBe("GLM-5");
    expect(displayName(row("DeepSeek: R1 (May)"))).toBe("R1");
  });
});

describe("familyOf", () => {
  it("reduces display names to family names per the 004 D1' rules", () => {
    // single letter+digit token reduces to the letter
    expect(familyOf(row("OpenAI: o3-pro"))).toBe("O");
    // word+digit token keeps the major version
    expect(familyOf(row("Qwen: Qwen3.5"))).toBe("Qwen3");
    // hyphenated display name joins with "-"
    expect(familyOf(row("Z.AI: GLM-5"))).toBe("GLM-5");
    // leading word plus a following word
    expect(familyOf(row("Anthropic: Claude Fable 5"))).toBe("Claude Fable");
    expect(familyOf(row("Google: Gemini 3 Flash"))).toBe("Gemini 3");
    // a date token is a version token
    expect(familyOf(row("Org: Foo 2025"))).toBe("Foo 2025");
    // FAMILY_NOISE tokens are skipped
    expect(familyOf(row("Org: Foo Instruct 7"))).toBe("Foo");
    // empty body falls back to the org
    expect(familyOf(row("Org:", "X", "x/y"))).toBe("X");
    expect(familyOf(row("Meta: Llama 4 Scout (2025)"))).toBe("Llama 4");
    // letter+digit first token reduces to the letter
    expect(familyOf(row("DeepSeek: R1 (May)"))).toBe("R");
    // word+number tokens inside a longer name
    expect(familyOf(row("Mistral: Mistral Medium 3.1"))).toBe("Mistral Medium");
    // size tokens read as versions (the isVer b-suffix)
    expect(familyOf(row("Org: Foo 12B"))).toBe("Foo 12");
    expect(familyOf(row("Org: Foo 70B"))).toBe("Foo 70");
  });
});
