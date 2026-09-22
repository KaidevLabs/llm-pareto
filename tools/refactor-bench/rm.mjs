// 042: remove a published bench entry — `npm run bench:rm <id>`. File
// surgery only (A3): the entry dir + its index.json row are removed; no
// commit, no push — the owner reviews and commits the deletion like a
// publish. Unknown or missing id → exit 1, nothing touched.
import path from "node:path";
import { readRegistry, removeEntry } from "./lib/registry.mjs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (args.length !== 1) {
  console.error("[rm] usage: bench:rm <id>");
  process.exit(1);
}

const bench = path.join(process.cwd(), "public", "bench");
try {
  const removed = removeEntry(bench, args[0]);
  const left = readRegistry(bench).length;
  console.log(`[rm] removed ${removed.id} — ${left} ${left === 1 ? "entry" : "entries"} left`);
  if (left < 2)
    console.log("[rm] fewer than two entries remain — the compare page shows its error state");
} catch (e) {
  console.error(`[rm] FAILED: ${e.message}`);
  process.exit(1);
}
