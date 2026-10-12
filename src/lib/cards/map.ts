import type { CardRef, Finish } from "@/lib/types";

/** Subset of the pokemontcg.io v2 card object we rely on. */
export interface TcgPlayerPriceBlock {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
  directLow?: number | null;
}

export interface RawPtcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  subtypes?: string[];
  supertype?: string;
  set: {
    id: string;
    name: string;
    series?: string;
    printedTotal?: number;
    total?: number;
    ptcgoCode?: string;
    releaseDate?: string; // "2023/09/22"
  };
  images?: { small?: string; large?: string };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, TcgPlayerPriceBlock | undefined>;
  };
}

const FULL_ART_RARITIES = new Set([
  "special illustration rare",
  "illustration rare",
  "ultra rare",
  "hyper rare",
  "rare ultra",
  "rare secret",
  "rare rainbow",
  "shiny ultra rare",
  "rare shiny gx",
  "mega hyper rare",
  "black white rare",
]);

const HOLO_RARITIES = new Set([
  "double rare",
  "shiny rare",
  "amazing rare",
  "radiant rare",
  "ace spec rare",
  "rare ace",
  "rare prime",
  "rare break",
  "rare prism star",
  "legend",
  "rare shining",
  "rare shiny",
  "trainer gallery rare holo",
  "classic collection",
]);

const NON_HOLO_RARITIES = new Set(["common", "uncommon", "rare"]);

export function inferFinish(raw: Pick<RawPtcgCard, "rarity" | "subtypes" | "tcgplayer">): Finish {
  const rarity = (raw.rarity ?? "").trim().toLowerCase();
  if (FULL_ART_RARITIES.has(rarity)) return "full-art";
  if (rarity.startsWith("rare holo") || HOLO_RARITIES.has(rarity)) return "holo";
  if (NON_HOLO_RARITIES.has(rarity)) return "non-holo";

  // Promos and odd rarities: fall back to which TCGplayer variants exist.
  const keys = Object.keys(raw.tcgplayer?.prices ?? {});
  const hasHolo = keys.some((k) => /holofoil/i.test(k) && !/reverse/i.test(k));
  const hasNormal = keys.some((k) => /normal/i.test(k));
  if (hasHolo && !hasNormal) return "holo";
  if (hasNormal && !hasHolo) return "non-holo";
  return "unknown";
}

/** "2023/09/22" → "2023-09-22"; returns undefined for anything unparseable. */
export function toIsoDate(d?: string): string | undefined {
  if (!d) return undefined;
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(d.trim());
  if (!m) return undefined;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

export function toCardRef(raw: RawPtcgCard): CardRef {
  const ref: CardRef = {
    id: raw.id,
    name: raw.name,
    setId: raw.set?.id ?? "",
    setName: raw.set?.name ?? "",
    number: raw.number,
    finish: inferFinish(raw),
  };
  if (raw.rarity) ref.rarity = raw.rarity;
  const rd = toIsoDate(raw.set?.releaseDate);
  if (rd) ref.releaseDate = rd;
  if (raw.images?.small) ref.imageSmall = raw.images.small;
  if (raw.images?.large) ref.imageLarge = raw.images.large;
  return ref;
}
