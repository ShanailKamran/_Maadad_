import { readdirSync, readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";

/** Versioned SQL migrations: runs migrations/*.sql in filename order, once each, each in a transaction. */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const url = process.env.DATABASE_URL;
  const isSupabase =
    url.includes("supabase.co") ||
    url.includes("supabase.com") ||
    process.env.DATABASE_SSL === "true";

  const pool = new Pool({
    connectionString: url,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await pool.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const dir = path.resolve("migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(readFileSync(path.join(dir, f), "utf8"));
      await c.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
      await c.query("COMMIT");
      console.log("applied", f);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  console.log("migrations up to date");
  await pool.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
