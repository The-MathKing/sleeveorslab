// CONTRACT (owned by data agent). Provider chain: PriceCharting (if key) -> pokemontcg.io TCGplayer raw -> estimate.
import type { CardRef, PriceQuote } from "@/lib/types";
export declare function getPrice(card: CardRef): Promise<PriceQuote>;
