// CONTRACT (owned by app-flows agent). Browser-only local persistence (IndexedDB via idb-keyval).
import type { CollectionItem } from "@/lib/types";
export declare function listCollection(): Promise<CollectionItem[]>;
export declare function saveToCollection(item: CollectionItem): Promise<void>;
export declare function removeFromCollection(id: string): Promise<void>;
