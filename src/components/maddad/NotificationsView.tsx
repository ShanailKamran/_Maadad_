"use client";

import React, { useTransition } from "react";
import {
  IconBell,
  IconCheck,
  IconInbox,
  IconInfo,
} from "../icons";
import {
  NotificationItem,
} from "./types";
import { fmtDateTime } from "./shared";
import { markReadAction } from "@/app/actions";

interface NotificationsViewProps {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  showToast: (msg: string) => void;
}

export function NotificationsView({
  notifications,
  onMarkAllRead,
  showToast,
}: NotificationsViewProps) {
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markReadAction();
      onMarkAllRead();
      showToast("All notifications marked as read.");
    });
  };

  return (
    <div style={{ maxWidth: 700, margin: "20px auto", width: "100%", padding: "0 12px" }}>
      <div className="plate-bolted">
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "var(--text-1)" }}>
                In-App Notifications (اطلاعات)
              </h1>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "var(--violet-600)",
                    color: "#fff",
                    borderRadius: "999px",
                    padding: "2px 8px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <p style={{ color: "var(--text-3)", fontSize: "0.82rem", margin: "4px 0 0" }}>
              Verified updates on bids received, accepted bookings, and status changes.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="btn btn-secondary btn-sm"
            >
              <IconCheck size={14} />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>

        {/* Informative note */}
        <div
          style={{
            background: "rgba(124, 58, 237, 0.05)",
            border: "1px solid var(--violet-950)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            fontSize: "0.78rem",
            color: "var(--text-3)",
            marginBottom: 16,
          }}
        >
          Note: In-app notices only. Automated SMS gateways and browser push notifications remain dormant for this Lahore trial.
        </div>

        {/* List */}
        {notifications.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 16px",
              background: "var(--ink-0)",
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--graphite-700)",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "var(--graphite-800)",
                color: "var(--text-3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
              }}
            >
              <IconInbox size={22} />
            </div>
            <div style={{ fontWeight: 700, color: "var(--text-2)", fontSize: "0.95rem" }}>
              No Notifications Yet
            </div>
            <p style={{ color: "var(--text-3)", fontSize: "0.82rem", margin: "4px 0 0" }}>
              You will receive alerts here when technicians bid on your jobs or when your bids are accepted.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.map((item) => {
              const isUnread = !item.read_at;
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 16px",
                    background: isUnread ? "rgba(124, 58, 237, 0.09)" : "var(--ink-0)",
                    border: isUnread ? "1px solid var(--violet-800)" : "1px solid var(--graphite-700)",
                    borderLeft: isUnread ? "3px solid var(--violet-400)" : "1px solid var(--graphite-700)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: isUnread ? "rgba(124, 58, 237, 0.25)" : "var(--graphite-800)",
                      color: isUnread ? "var(--violet-300)" : "var(--text-3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconBell size={16} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontWeight: isUnread ? 700 : 600, fontSize: "0.9rem", color: isUnread ? "var(--text-1)" : "var(--text-2)" }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-3)", whiteSpace: "nowrap" }}>
                        {fmtDateTime(item.created_at)}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-2)", margin: "4px 0 0", lineHeight: 1.4 }}>
                      {item.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
