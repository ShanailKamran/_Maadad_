"use client";

import React, { useState } from "react";
import {
  IconShield,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconInfo,
} from "../icons";
import {
  AppUser,
  ReportItem,
  AuditLogItem,
} from "./types";
import { fmtDateTime } from "./shared";
import { moderateAction } from "@/app/actions";

interface ModerationViewProps {
  currentUser: AppUser | null;
  reports: ReportItem[];
  auditLogs: AuditLogItem[];
  showToast: (msg: string) => void;
  onNavigateAuth: () => void;
}

export function ModerationView({
  currentUser,
  reports,
  auditLogs,
  showToast,
  onNavigateAuth,
}: ModerationViewProps) {
  const [activeReports, setActiveReports] = useState(reports);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!currentUser?.is_admin && process.env.NODE_ENV === "production") {
    return (
      <div style={{ maxWidth: 540, margin: "32px auto", width: "100%", padding: "0 16px" }}>
        <div className="plate" style={{ textAlign: "center", padding: "36px 24px" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(244, 63, 94, 0.15)",
              color: "var(--rose-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <IconShield size={24} />
          </div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px", color: "var(--text-1)" }}>
            Moderation Portal Restricted
          </h2>
          <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.5, margin: "0 0 20px" }}>
            This portal is restricted to platform administrators and safety reviewers.
          </p>
          <button type="button" onClick={onNavigateAuth} className="btn btn-primary" style={{ margin: "0 auto" }}>
            Switch to Fatima Moderator Demo
          </button>
        </div>
      </div>
    );
  }

  const handleAction = async (reportId: string, action: "dismiss" | "warn_user" | "suspend_user") => {
    let reason = "Admin resolution";
    if (action === "warn_user") {
      const input = prompt("Reason for warning the user:");
      if (!input) return;
      reason = input;
    } else if (action === "suspend_user") {
      const input = prompt("Reason for suspending this account permanently:");
      if (!input) return;
      reason = input;
    }

    setBusyId(reportId);
    const fd = new FormData();
    fd.set("reportId", reportId);
    fd.set("action", action);
    fd.set("reason", reason);

    const res = await moderateAction(null, fd);
    setBusyId(null);

    if (res?.error) {
      showToast(`Error: ${res.error}`);
    } else {
      showToast(action === "dismiss" ? "Report dismissed." : action === "warn_user" ? "Warning issued." : "Account suspended.");
      setActiveReports((prev) => prev.filter((r) => r.id !== reportId));
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", width: "100%", padding: "0 12px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div className="plate-bolted">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "var(--amber-400)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconShield size={18} />
              </div>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "var(--text-1)" }}>
                Moderation &amp; Safety Dashboard (نگرانی و تحفظ)
              </h1>
            </div>
            <p style={{ color: "var(--text-3)", fontSize: "0.82rem", margin: "4px 0 0" }}>
              Review flagged listings, disputes, technician reports, and safety escalations in Lahore.
            </p>
          </div>

          <span
            style={{
              padding: "4px 10px",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "var(--amber-300)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.78rem",
              fontWeight: 700,
            }}
          >
            {activeReports.length} Open Reports
          </span>
        </div>
      </div>

      {/* Reports Queue */}
      <div className="plate" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
          Pending Incident Reports
        </h2>

        {activeReports.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "36px 16px",
              background: "var(--ink-0)",
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--graphite-700)",
              color: "var(--emerald-400)",
            }}
          >
            <IconCheck size={28} style={{ margin: "0 auto 8px" }} />
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>All Clear</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-3)", marginTop: 2 }}>
              No open reports or unresolved user grievances.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activeReports.map((r) => (
              <div
                key={r.id}
                style={{
                  background: "var(--ink-0)",
                  border: "1px solid var(--graphite-700)",
                  borderRadius: "var(--radius-sm)",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: "rgba(244, 63, 94, 0.15)",
                        color: "var(--rose-400)",
                        textTransform: "uppercase",
                      }}
                    >
                      {r.target_type}
                    </span>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-2)", fontFamily: "monospace" }}>
                      Target: {r.target_id.slice(0, 14)}...
                    </span>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>
                    {fmtDateTime(r.created_at)}
                  </span>
                </div>

                <div style={{ fontSize: "0.88rem", color: "var(--text-1)", fontWeight: 600 }}>
                  Reason: {r.reason || r.category || "General Safety Concern"}
                </div>

                {r.details && (
                  <div
                    style={{
                      background: "var(--ink-1)",
                      border: "1px solid var(--graphite-800)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      fontSize: "0.82rem",
                      color: "var(--text-2)",
                      fontStyle: "italic",
                    }}
                  >
                    &ldquo;{r.details}&rdquo;
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", paddingTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleAction(r.id, "dismiss")}
                    disabled={busyId === r.id}
                    className="btn btn-secondary btn-sm"
                  >
                    Dismiss Report
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(r.id, "warn_user")}
                    disabled={busyId === r.id}
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--amber-300)", border: "1px solid rgba(245, 158, 11, 0.3)" }}
                  >
                    Warn Target
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(r.id, "suspend_user")}
                    disabled={busyId === r.id}
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--rose-400)", border: "1px solid rgba(244, 63, 94, 0.3)" }}
                  >
                    Suspend Target
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Log Stream */}
      <div className="plate" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
          Platform Safety &amp; Audit Trail
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {auditLogs.slice(0, 10).map((log) => (
            <div
              key={log.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "var(--ink-0)",
                border: "1px solid var(--graphite-800)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "monospace", color: "var(--violet-300)", fontWeight: 700 }}>
                  {log.action}
                </span>
                <span style={{ color: "var(--text-3)" }}>
                  on {log.target_type} ({log.target_id.slice(0, 8)}...)
                </span>
              </div>
              <span style={{ color: "var(--text-3)", fontSize: "0.72rem" }}>
                Actor: {log.actor_id ? log.actor_id.slice(0, 8) : "system"} · {fmtDateTime(log.created_at)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
