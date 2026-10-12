/**
 * Free-text card query parsing → pokemontcg.io Lucene-style `q` parameter.
 * Pure functions, no network.
 *
 * Examples:
 *   "charizard 199"      → name:charizard* number:199
 *   "pikachu 25/102"     → name:pikachu* number:25 set.printedTotal:102
 *   "moonbreon"          → name:umbreon* name:vmax* set.id:swsh7 number:215
 *   "sv3pt5 199"         → set.id:sv3pt5 number:199
 *   "umbreon OBF"        → name:umbreon* set.ptcgoCode:OBF
 */

export interface ParsedQuery {
  nameTokens: string[];
  number?: string;
  printedTotal?: string;
  setId?: string;
  ptcgoCode?: string;
}

/** Community nicknames → canonical query. Keep small and obvious. */
const NICKNAMES: Record<string, Partial<ParsedQuery> & { nameTokens: string[] }> = {
  moonbreon: { nameTokens: ["umbreon", "vmax"], setId: "swsh7", number: "215" },
  sunbreon: { nameTokens: ["umbreon", "v"], setId: "swsh7", number: "189" },
  moonbreonv: { nameTokens: ["umbreon", "v"], setId: "swsh7", number: "189" },
  zard: { nameTokens: ["charizard"] },
  zards: { nameTokens: ["charizard"] },
  rayray: { nameTokens: ["rayquaza"] },
};

/** pokemontcg.io set ids: sv3pt5, swsh7, swsh12pt5gg, sm115, base1, xy12, cel25, pgo, ... */
const SET_ID_RE =
  /^(?:sv\d{1,2}(?:pt\d+)?|svp|sve|swsh\d{1,2}(?:pt\d+)?(?:tg|gg)?|swshp|sm\d{1,3}(?:a)?|smp|xy\d{1,2}|xyp|bw\d{1,2}|bwp|dp\d|dpp|pl\d|hgss\d|ex\d{1,2}|base\d|neo\d|gym\d|ecard\d|pop\d|det1|cel25c?|col1|ru1|si1|np|mcd\d{2}|pgo|g1|dc1|hsp|lc|zsv10pt5|rsv10pt5)$/;

/** Known PTCGO / Live set codes (uppercase). Only honoured when typed in caps. */
const PTCGO_CODES = new Set([
  "SVI", "PAL", "OBF", "MEW", "PAR", "PAF", "TEF", "TWM", "SFA", "SCR", "SSP", "PRE", "JTG", "DRI",
  "BLK", "WHT", "SSH", "RCL", "DAA", "CPA", "VIV", "SHF", "BST", "CRE", "EVS", "FST", "BRS", "ASR",
  "PGO", "LOR", "SIT", "CRZ", "CEL", "UNM", "UNB", "TEU", "CEC", "HIF", "DET", "LOT", "CES", "FLI",
  "UPR", "CIN", "SLG", "BUS", "GRI", "SUM", "EVO", "STS", "FCO", "GEN", "BKP", "BKT", "AOR", "ROS",
  "PRC", "PHF", "FFI", "FLF", "XY", "KSS",
]);

const STOPWORDS = new Set(["card", "cards", "pokemon", "pokémon", "the", "tcg", "of"]);

/** Strip leading zeros from purely numeric collector numbers ("004" → "4"). */
export function normalizeNumber(n: string): string {
  if (/^\d+$/.test(n)) return String(parseInt(n, 10));
  const m = /^([a-z]+)(\d+)$/i.exec(n);
  if (m) return m[1].toUpperCase() + m[2]; // TG05, GG44, SV107, RC5
  return n;
}

export function parseQuery(input: string): ParsedQuery {
  const out: ParsedQuery = { nameTokens: [] };
  const rawTokens = input
    .normalize("NFC")
    .replace(/[,;]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);

  for (const original of rawTokens) {
    const tok = original.toLowerCase().replace(/^#/, "");
    if (!tok) continue;

    const nick = NICKNAMES[tok];
    if (nick) {
      out.nameTokens.push(...nick.nameTokens);
      out.setId ??= nick.setId;
      out.number ??= nick.number;
      continue;
    }

    // "25/102", "#025/102", "TG05/TG30"
    const frac = /^([a-z]{0,3}\d+)\/([a-z]{0,3}\d+)$/i.exec(tok);
    if (frac) {
      out.number ??= normalizeNumber(frac[1]);
      if (/^\d+$/.test(frac[2])) out.printedTotal ??= String(parseInt(frac[2], 10));
      continue;
    }

    // Prefixed collector numbers: TG05, GG44, RC5, SV107 (shiny vault; set ids sv1..sv10 never have 3 digits)
    if (/^(?:tg|gg|rc)\d{1,3}$/.test(tok) || /^sv\d{3}$/.test(tok)) {
      out.number ??= normalizeNumber(tok);
      continue;
    }

    if (/^\d{1,4}[a-z]?$/.test(tok)) {
      out.number ??= normalizeNumber(tok);
      continue;
    }

    if (SET_ID_RE.test(tok)) {
      out.setId ??= tok;
      continue;
    }

    if (original === original.toUpperCase() && PTCGO_CODES.has(original)) {
      out.ptcgoCode ??= original;
      continue;
    }

    if (STOPWORDS.has(tok)) continue;

    const clean = tok.replace(/[^\p{L}\p{N}'-]/gu, "").replace(/'/g, "");
    if (clean) out.nameTokens.push(clean);
  }

  // A lone all-caps code with no name, e.g. "MEW 151": treat it as a name instead.
  if (out.ptcgoCode && out.nameTokens.length === 0 && !out.setId) {
    out.nameTokens.push(out.ptcgoCode.toLowerCase());
    delete out.ptcgoCode;
  }
  return out;
}

/** Escape a token for use in a Lucene term (we already strip most punctuation). */
function term(s: string): string {
  return s.replace(/([+\-!(){}[\]^"~*?:\\/&|])/g, "\\$1");
}

export function buildLuceneQuery(p: ParsedQuery, opts: { includeNumber?: boolean } = {}): string {
  const includeNumber = opts.includeNumber ?? true;
  const parts: string[] = [];
  for (const n of p.nameTokens) parts.push(`name:${term(n)}*`);
  if (includeNumber && p.number) parts.push(`number:${term(p.number)}`);
  if (includeNumber && p.printedTotal) parts.push(`set.printedTotal:${p.printedTotal}`);
  if (p.setId) parts.push(`set.id:${term(p.setId)}`);
  if (p.ptcgoCode) parts.push(`set.ptcgoCode:${term(p.ptcgoCode)}`);
  return parts.join(" ");
}

export function isEmptyQuery(p: ParsedQuery): boolean {
  return !p.nameTokens.length && !p.number && !p.setId && !p.ptcgoCode;
}
