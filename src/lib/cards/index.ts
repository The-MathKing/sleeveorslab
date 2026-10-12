// CONTRACT (owned by data agent). Card search via pokemontcg.io (server-side, key in env).
import type { CardRef } from "@/lib/types";
export declare function searchCards(q: string, opts?: { limit?: number }): Promise<CardRef[]>;
export declare function getCard(id: string): Promise<CardRef | null>;
