// Model family, derived mechanically from the OpenRouter display name
// (plan 004 D1'; owner directive: families are 100% source-derived, no
// hand-curated map). From or_name: drop parentheticals and the "Org: "
// prefix, drop date and size tokens; a single letter+digit token reduces
// to the letter ("o1" -> "O"), a word+digit token keeps letters plus the
// major version ("Qwen3.5" -> "Qwen3", "GPT-5.6" -> "GPT-5"), otherwise
// the leading word plus a following word ("Claude Opus"). Families follow
// the source: when OR renames a line, they move on the next data refresh.

const FAMILY_NOISE = new Set(["instruct", "thinking", "preview", "latest", "chat", "beta"]);

export function orgOf(d: Row): string {
  return d.arena_org && d.arena_org.trim() !== ""
    ? d.arena_org
    : d.or_id.split("/")[0];
}

// Cleaned OpenRouter display name: parentheticals and the "Org: " prefix
// stripped. Shared by familyOf and the frontier point labels (plan 007 D5).
export function displayName(d: Row): string {
  return (d.or_name || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/^[A-Za-z0-9 .&'-]+:\s*/, "")
    .trim();
}

export function familyOf(d: Row): string {
  const body = displayName(d);
  if (!body) return orgOf(d);
  const parts = body.split(/[\s-]+/).filter(Boolean);
  const join = body.split(" ")[0].includes("-") ? "-" : " ";
  const isVer = (t: string) => /^\d+(\.\d+)*[a-z]{0,2}$/i.test(t);
  const isSize = (t: string) => /^\d+x?\d*b$/i.test(t) || /^[a-z]\d+b$/i.test(t);
  const isDate = (t: string) => /^\d{4}$/.test(t);
  const isWord = (t: string) =>
    !!t && !isVer(t) && !isSize(t) && !isDate(t) && !FAMILY_NOISE.has(t.toLowerCase());
  const major = (t: string) => (/\d+(\.\d+)*/.exec(t) as RegExpExecArray)[0].split(".")[0];
  const t0 = parts[0];
  let m: RegExpExecArray | null;
  if ((m = /^([a-z])\d/i.exec(t0))) return m[1].toUpperCase();
  if ((m = /^([a-z]{2,})\d/i.exec(t0))) return t0.slice(0, m[1].length) + major(t0);
  const t1 = parts[1];
  if (t1 && isVer(t1)) return t0 + join + major(t1);
  if (t1 && /^[a-z]\d/i.test(t1)) return t0 + join + t1[0].toUpperCase();
  const w = [t1, ...parts.slice(2)].find(isWord);
  return w ? t0 + join + w.replace(/\+/g, "") : t0;
}
