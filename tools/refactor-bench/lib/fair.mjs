// 029 A4: fairness copy — the measured worktree serves the identical data
// snapshot as the live tree (033 A11: only `--ref` runs measure a worktree).
import { cp, rm } from "node:fs/promises";
import path from "node:path";

export async function fairCopy(root, oldDir) {
  for (const d of ["data", "assets", "fonts"]) {
    const dst = path.join(oldDir, "public", d);
    await rm(dst, { recursive: true, force: true });
    await cp(path.join(root, "public", d), dst, { recursive: true });
  }
}
