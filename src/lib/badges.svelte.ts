// The data-URL badge store and its canvas compositing (plan 007, store in
// 035): the frontier logo sits on a dark disc with an org-color ring,
// composited once per org at load. Compositing into the symbol image means
// the hover glow (canvas shadow follows the drawn alpha) halos the disc —
// the bubble, not the logo.
//
// Off the boot critical path (plan 035 D1/D2, the endpoints.svelte.ts
// pattern): the first chart renders fallback letter discs and buildBadges()
// fills the store per-org as each logo lands; the chart seam's reactive
// reads re-render and swap the symbol in — one merge push per landed org.

import { ORG_FALLBACK } from "./colors";
import { data } from "./data.svelte";

// org -> composited badge data-URL. Phase-encoded by presence: a key not
// set yet is the placeholder phase, null is a landed load-failure.
const BADGE = $state({} as Record<string, string | null | undefined>);

// undefined = not yet attempted (placeholder phase — the fallback letter
// disc renders); null = attempted, load failed (the raw logo renders —
// soft, plan 007); string = the real badge. Reading a missing key is
// tracked: a later fill re-runs the reading render (the swap).
export function badgeFor(org: string): string | null | undefined {
  return BADGE[org];
}

function compositeBadge(
  draw: (x: CanvasRenderingContext2D) => void,
  color: string
): string {
  // plan 035 D3: 48px canvas (2× the 24px symbol display; was 256 since
  // 007) — 007's disc geometry rescaled (128→24, 112→21, ring 120→22.5 at
  // lineWidth 12→2.25, image draw 150→28, baseline 136→25.5, font 110→21).
  const c = document.createElement("canvas");
  c.width = c.height = 48;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0a0e16";
  x.beginPath();
  x.arc(24, 24, 21, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = color;
  x.lineWidth = 2.25;
  x.beginPath();
  x.arc(24, 24, 22.5, 0, Math.PI * 2);
  x.stroke();
  draw(x);
  return c.toDataURL();
}

function badgeFromImage(img: HTMLImageElement, color: string): string {
  return compositeBadge((x) => {
    const s = Math.min(28 / img.width, 28 / img.height);
    const w = img.width * s;
    const h = img.height * s;
    x.drawImage(img, 24 - w / 2, 24 - h / 2, w, h);
  }, color);
}

export function fallbackBadge(org: string): string {
  const letter = (org.trim()[0] || "?").toUpperCase();
  const color = data.orgColor[org] || ORG_FALLBACK;
  return compositeBadge((x) => {
    x.fillStyle = color;
    x.font = "600 21px Inter, sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(letter, 24, 25.5);
  }, color);
}

export async function buildBadges(): Promise<void> {
  const logos = data.meta?.logos || {};
  await Promise.all(
    Object.entries(logos).map(async ([org, file]) => {
      const img = await new Promise<HTMLImageElement | null>((res) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => res(null);
        i.src = "assets/logos/" + file;
      });
      // a failed load leaves no badge — the raw logo still renders (soft)
      BADGE[org] = img
        ? badgeFromImage(img, data.orgColor[org] || ORG_FALLBACK)
        : null;
    })
  );
}