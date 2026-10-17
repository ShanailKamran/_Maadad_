import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { q, isPostgresAvailable } from "@/lib/db";
import { store } from "@/lib/store";
import { dt } from "@/lib/format";
import { ActionForm, Submit } from "@/components/ActionForm";
import { markReadAction } from "../actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = !(await isPostgresAvailable())
    ? store.listNotifications(user.id)
    : await q<{
        id: string;
        type: string;
        title: string;
        body: string;
        ref_type: string | null;
        ref_id: string | null;
        read_at: Date | null;
        created_at: Date;
      }>(
        `SELECT id, type, title, body, ref_type, ref_id, read_at, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 100`,
        [user.id],
      );

  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, marginInlineEnd: "auto" }}>Notifications</h1>
        {hasUnread && (
          <ActionForm action={markReadAction}>
            <Submit className="btn btn-ghost btn-sm">Mark all as read</Submit>
          </ActionForm>
        )}
      </div>

      <p className="hint">
        Showing your in-app notifications. (Push and SMS notification channels are not enabled yet).
      </p>

      {notifications.length === 0 ? (
        <div className="card empty">
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="grid">
          {notifications.map((n) => {
            const isUnread = !n.read_at;
            const link = n.ref_type === "job" && n.ref_id ? `/jobs/${n.ref_id}` : null;

            return (
              <div
                key={n.id}
                className="card"
                style={{
                  borderInlineStart: isUnread ? "4px solid var(--brand)" : "1px solid var(--line)",
                  background: isUnread ? "#f4faf7" : "var(--surface)",
                }}
              >
                <div className="row">
                  <strong style={{ marginInlineEnd: "auto" }}>{n.title}</strong>
                  <span className="meta">{dt(n.created_at)}</span>
                </div>

                <p style={{ margin: "6px 0 8px" }}>{n.body}</p>

                {link && (
                  <div>
                    <Link className="btn btn-ghost btn-sm" href={link}>
                      View details
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
