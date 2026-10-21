import { Pool, PoolClient, QueryResultRow } from "pg";

const g = globalThis as unknown as { __kaamPool?: Pool; __pgChecked?: boolean; __pgAvailable?: boolean };

function createPool(): Pool {
  const url = process.env.DATABASE_URL || "postgres://kaam:kaam_local_dev_only@127.0.0.1:5432/kaam";
  const isSupabase =
    url.includes("supabase.co") ||
    url.includes("supabase.com") ||
    process.env.DATABASE_SSL === "true";

  return new Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 5000,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });
}

export function pool(): Pool {
  return (g.__kaamPool ??= createPool());
}

export type Db = Pool | PoolClient;

let availabilityPromise: Promise<boolean> | null = null;

/**
 * Checks whether PostgreSQL is reachable with quick timeout.
 * Caches result so subsequent calls are instantaneous.
 */
export async function isPostgresAvailable(): Promise<boolean> {
  if (g.__pgChecked) return g.__pgAvailable ?? false;
  if (availabilityPromise) return availabilityPromise;

  availabilityPromise = (async () => {
    try {
      const client = await pool().connect();
      await client.query("SELECT 1");
      client.release();
      g.__pgAvailable = true;
      g.__pgChecked = true;
      return true;
    } catch {
      g.__pgAvailable = false;
      g.__pgChecked = true;
      return false;
    } finally {
      availabilityPromise = null;
    }
  })();

  return availabilityPromise;
}

/** Parameterised queries only. Never interpolate user input into SQL text. */
export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Db = pool(),
): Promise<T[]> {
  const r = await db.query<T>(text, params);
  return r.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Db = pool(),
): Promise<T | null> {
  return (await q<T>(text, params, db))[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}
