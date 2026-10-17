import { one, Db, isPostgresAvailable } from "./db";
import { AppError } from "./state";
import { store } from "./store";

/**
 * Fixed-window rate limiter backed by Postgres (works across server instances).
 * Falls back to in-memory sliding window when Postgres is not reachable.
 * Throws AppError(rate_limited) when `limit` is exceeded within `windowSec`.
 */
export async function rateLimit(key: string, limit: number, windowSec: number, db?: Db): Promise<void> {
  if (!(await isPostgresAvailable())) {
    store.checkRateLimit(key, limit, windowSec);
    return;
  }
  const row = await one<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key, windowSec],
    db,
  );
  if (row && row.count > limit) {
    throw new AppError("Too many attempts. Please wait a few minutes and try again.", "rate_limited");
  }
}
