import { q, Db } from "./db";
import { redact } from "./logger";

/**
 * Append-only audit trail. Metadata is passed through the logger redactor, which strips
 * keys that look like phone/address/coordinates/codes/tokens/storage keys.
 * Callers must still avoid passing sensitive values.
 */
export async function audit(
  actorId: string | null,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata: Record<string, unknown> = {},
  db?: Db,
): Promise<void> {
  await q(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata)
     VALUES ($1,$2,$3,$4,$5)`,
    [actorId, action, targetType ?? null, targetId ?? null, JSON.stringify(redact(metadata))],
    db,
  );
}
