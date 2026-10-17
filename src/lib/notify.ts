import { q, Db, isPostgresAvailable } from "./db";
import { log } from "./logger";
import { store } from "./store";

/**
 * Notification abstraction. In-app rows are always written. Push/SMS channels are STUBS:
 * they never report delivery. Do not tell users push/SMS is live until a real channel
 * implementation + credentials exist and returns success.
 *
 * Content rule: bodies must never contain exact addresses or phone numbers.
 */
export interface NotificationChannel {
  readonly name: "push" | "sms";
  deliver(userId: string, title: string, body: string): Promise<boolean>;
}

const channels: NotificationChannel[] = []; // intentionally empty: none are implemented

export async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  ref?: { type: string; id: string },
  db?: Db,
): Promise<void> {
  if (!(await isPostgresAvailable())) {
    store.notify(userId, type, title, body, ref);
    return;
  }
  await q(
    `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, type, title, body, ref?.type ?? null, ref?.id ?? null],
    db,
  );
  for (const ch of channels) {
    try {
      await ch.deliver(userId, title, body);
    } catch (e) {
      log.warn("notify_channel_failed", { channel: ch.name, err: e });
    }
  }
}
