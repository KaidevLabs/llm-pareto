// The `tour=1` autostart flag's handoff (027 A3): App.svelte reads the URL
// once at boot and publishes the one-shot flag here; the 3D Panel consumes
// it when its chart instance exists. A module binding, not ui state — the
// tour is an entry action, never shareable/serializable state (A5).

let flag = false;
const readers: Array<(v: boolean) => void> = [];

export function setAutotour(v: boolean): void {
  flag = v;
  for (const r of readers.splice(0)) r(v);
}

// The Panel polls this at its render effect; the flag stays until consumed.
export function takeAutotour(): boolean {
  const v = flag;
  flag = false;
  return v;
}

export function peekAutotour(): boolean {
  return flag;
}

void readers;
