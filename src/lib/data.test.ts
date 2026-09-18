import { describe, it, expect, afterEach } from "vitest";
import { data, logoFor } from "./data.svelte";
import type { Meta } from "./types";

const meta: Meta = {
  fetched_at: "2026-09-18T00:00:00Z",
  logos: { Anthropic: "anthropic.svg", "Z.AI": "z-ai.svg" },
  join: {
    combined: 154, unmatched_arena: 0, unmatched_openrouter: 0,
    by_method: { exact: 1 },
  },
};

// logoFor reads the data store's meta (set once per page load).
describe("logoFor", () => {
  afterEach(() => {
    data.meta = null;
  });
  it("derives the mechanical asset path, null when absent", () => {
    data.meta = meta;
    expect(logoFor("Anthropic")).toBe("assets/logos/anthropic.svg");
    expect(logoFor("OpenAI")).toBe(null);
    expect(logoFor("")).toBe(null);
  });
  it("stays null without meta", () => {
    expect(logoFor("Anthropic")).toBe(null);
  });
});
