// The data-URL badge cache and its canvas compositing (plan 007): the
// frontier logo sits on a dark disc with an org-color ring, composited once
// per org at load. Compositing into the symbol image means the hover glow
// (canvas shadow follows the drawn alpha) halos the disc — the bubble, not
// the logo. Badges are built once per page load, before first render.

import { ORG_FALLBACK } from "./colors";
import { data } from "./data.svelte";

const BADGE: Record<string, string | null> = {};

export function badgeFor(org: string): string | null {
  return BADGE[org] ?? null;
}

function compositeBadge(
  draw: (x: CanvasRenderingContext2D) => void,
  color: string
): string {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0a0e16";
  x.beginPath();
  x.arc(128, 128, 112, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = color;
  x.lineWidth = 12;
  x.beginPath();
  x.arc(128, 128, 120, 0, Math.PI * 2);
  x.stroke();
  draw(x);
  return c.toDataURL();
}

function badgeFromImage(img: HTMLImageElement, color: string): string {
  return compositeBadge((x) => {
    const s = Math.min(150 / img.width, 150 / img.height);
    const w = img.width * s;
    const h = img.height * s;
    x.drawImage(img, 128 - w / 2, 128 - h / 2, w, h);
  }, color);
}

export function fallbackBadge(org: string): string {
  const letter = (org.trim()[0] || "?").toUpperCase();
  const color = data.orgColor[org] || ORG_FALLBACK;
  return compositeBadge((x) => {
    x.fillStyle = color;
    x.font = "600 110px Inter, sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(letter, 128, 136);
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
