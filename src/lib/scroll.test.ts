import { describe, it, expect, afterEach } from "vitest";
import { scrollToCompare, scrollToDrawer } from "./scroll";

// jsdom implements no scrolling — a hand stub records the receiver and the
// argument so the tests pin both helpers' contract.
let last: { el: Element; opts: unknown } | null = null;
const proto = Element.prototype;
const real = proto.scrollIntoView;

function install(): void {
  proto.scrollIntoView = function (this: Element, opts?: ScrollIntoViewOptions) {
    last = { el: this, opts };
  };
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

afterEach(() => {
  if (real === undefined) delete (proto as { scrollIntoView?: unknown }).scrollIntoView;
  else proto.scrollIntoView = real;
  last = null;
  document.body.innerHTML = "";
});

describe("scroll helpers (039 step 4 — typed targets)", () => {
  it("scrollToCompare scrolls the #compare section into view", () => {
    install();
    const el = document.createElement("section");
    el.id = "compare";
    document.body.append(el);
    scrollToCompare();
    expect(last!.el).toBe(el);
    expect(last!.opts).toEqual({ behavior: "smooth", block: "start" });
  });

  it("scrollToCompare without a target is a silent no-op", () => {
    install();
    expect(() => scrollToCompare()).not.toThrow();
    expect(last).toBe(null);
  });

  it("scrollToDrawer waits one frame (mount-flush) then scrolls the drawer", async () => {
    install();
    scrollToDrawer();
    expect(last).toBe(null); // pre-frame: nothing scrolled yet
    const el = document.createElement("aside");
    el.className = "drawer";
    document.body.append(el);
    await frame();
    expect(last!.el).toBe(el);
    expect(last!.opts).toEqual({ behavior: "smooth", block: "start" });
  });
});
