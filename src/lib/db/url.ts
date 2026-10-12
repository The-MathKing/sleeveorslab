// Finds the Postgres connection string in the environment.
// Vercel's storage integrations add a configurable prefix (the Neon connect dialog defaults to
// "STORAGE", giving STORAGE_URL / STORAGE_DATABASE_URL / STORAGE_POSTGRES_URL), so look for the
// conventional names first, then any prefixed variant that holds a postgres:// URL.
type Env = Record<string, string | undefined>;

const PREFERRED = ["DATABASE_URL", "POSTGRES_URL", "STORAGE_URL", "STORAGE_DATABASE_URL", "STORAGE_POSTGRES_URL"];
// Pooled URLs first; *_UNPOOLED / *_NON_POOLING are fallbacks.
const SUFFIXES = ["_DATABASE_URL", "_POSTGRES_URL", "_URL"];

const isPg = (v: string | undefined): v is string => !!v && /^postgres(ql)?:\/\//i.test(v.trim());

export function resolveDatabaseUrl(env: Env = process.env): string | undefined {
  for (const k of PREFERRED) if (isPg(env[k])) return env[k]!.trim();
  const keys = Object.keys(env).sort();
  for (const suffix of SUFFIXES) {
    const k = keys.find((key) => key.endsWith(suffix) && !/UNPOOLED|NON_POOLING/.test(key) && isPg(env[key]));
    if (k) return env[k]!.trim();
  }
  const k = keys.find((key) => isPg(env[key]));
  return k ? env[k]!.trim() : undefined;
}

/** Name (never the value) of the variable that supplied the URL, for /api/health. */
export function databaseUrlSource(env: Env = process.env): string | null {
  const url = resolveDatabaseUrl(env);
  if (!url) return null;
  return Object.keys(env).sort().find((k) => env[k]?.trim() === url && PREFERRED.includes(k))
    ?? Object.keys(env).sort().find((k) => env[k]?.trim() === url) ?? null;
}
