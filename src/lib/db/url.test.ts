import { describe, expect, it } from "vitest";
import { databaseUrlSource, resolveDatabaseUrl } from "./url";

const pg = (n: string) => `postgres://u:p@${n}.neon.tech/db?sslmode=require`;

describe("resolveDatabaseUrl", () => {
  it("prefers DATABASE_URL", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: pg("a"), STORAGE_URL: pg("b") })).toBe(pg("a"));
  });
  it("finds Vercel's STORAGE-prefixed Neon variables", () => {
    expect(resolveDatabaseUrl({ STORAGE_URL: pg("s") })).toBe(pg("s"));
    expect(resolveDatabaseUrl({ STORAGE_URL_UNPOOLED: pg("u"), STORAGE_DATABASE_URL: pg("d") })).toBe(pg("d"));
  });
  it("finds a custom prefix, preferring pooled", () => {
    expect(resolveDatabaseUrl({ MYDB_URL_UNPOOLED: pg("u"), MYDB_URL: pg("p") })).toBe(pg("p"));
    expect(databaseUrlSource({ MYDB_URL: pg("p") })).toBe("MYDB_URL");
  });
  it("ignores non-postgres values", () => {
    expect(resolveDatabaseUrl({ SITE_URL: "https://x.com", DATABASE_URL: "" })).toBeUndefined();
  });
});
