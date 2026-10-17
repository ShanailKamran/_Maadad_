"use client";

import React, { useState } from "react";
import {
  IconSettings,
  IconCheck,
  IconShield,
  IconAlertCircle,
  IconUser,
} from "../icons";
import { AppUser } from "./types";
import { saveNameAction, deleteAccountAction } from "@/app/actions";

interface SettingsViewProps {
  currentUser: AppUser | null;
  showToast: (msg: string) => void;
  onNavigateAuth: () => void;
}

export function SettingsView({
  currentUser,
  showToast,
  onNavigateAuth,
}: SettingsViewProps) {
  const [displayName, setDisplayName] = useState(currentUser?.display_name || "");
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!currentUser) {
    return (
      <div style={{ maxWidth: 540, margin: "32px auto", width: "100%", padding: "0 16px" }}>
        <div className="plate" style={{ textAlign: "center", padding: "36px 24px" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(124, 58, 237, 0.15)",
              color: "var(--violet-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <IconSettings size={24} />
          </div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px", color: "var(--text-1)" }}>
            Sign In for Account Settings
          </h2>
          <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.5, margin: "0 0 20px" }}>
            Sign in to manage your display name, view role permissions, or adjust platform preferences.
          </p>
          <button type="button" onClick={onNavigateAuth} className="btn btn-primary" style={{ margin: "0 auto" }}>
            Sign In / Switch Persona
          </button>
        </div>
      </div>
    );
  }

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast("Please enter a name.");
      return;
    }
    setSavingName(true);
    const fd = new FormData();
    fd.set("displayName", displayName.trim());
    const res = await saveNameAction(null, fd);
    setSavingName(false);

    if (res?.error) {
      showToast(`Error: ${res.error}`);
    } else {
      showToast("Display name updated!");
    }
  };

  const handleDeleteAccount = async () => {
    const input = prompt("To permanently delete your Lahore pilot account, type DELETE:");
    if (input !== "DELETE") {
      if (input !== null) {
        showToast("Account deletion cancelled. You must type DELETE exactly.");
      }
      return;
    }

    setDeleting(true);
    const fd = new FormData();
    fd.set("confirm", "DELETE");
    const res = await deleteAccountAction(null, fd);
    setDeleting(false);

    if (res?.error) {
      showToast(`Error: ${res.error}`);
    } else {
      showToast("Account deleted.");
      window.location.reload();
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "20px auto", width: "100%", padding: "0 12px" }}>
      <div className="plate-bolted" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "var(--text-1)" }}>
            Account &amp; Settings (سیٹنگز و اکاؤنٹ)
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: "0.82rem", margin: "4px 0 0" }}>
            Configure your marketplace profile, view your active roles, and review operating terms.
          </p>
        </div>

        {/* Display Name */}
        <form onSubmit={handleSaveName} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            htmlFor="settings-name"
            style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)" }}
          >
            Your Display Name (ظاہر ہونے والا نام):
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              id="settings-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Tariq Mehmood"
              style={{
                flex: 1,
                background: "var(--ink-0)",
                border: "1px solid var(--graphite-600)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                color: "var(--text-1)",
                fontSize: "0.92rem",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={savingName}
              className="btn btn-secondary"
            >
              <IconCheck size={16} />
              <span>{savingName ? "Saving..." : "Save"}</span>
            </button>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
            Associated with verified mobile number: <strong>{currentUser.phone}</strong>
          </div>
        </form>

        {/* Dual Marketplace Roles */}
        <div
          style={{
            background: "var(--ink-0)",
            padding: "14px 16px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--graphite-700)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-1)" }}>
              Dual Marketplace Privileges
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: 2 }}>
              A single Lahore account can post jobs as a customer and submit bids as an independent technician.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 4,
                background: "rgba(124, 58, 237, 0.15)",
                color: "var(--violet-300)",
              }}
            >
              Customer Active
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 4,
                background: "rgba(59, 130, 246, 0.15)",
                color: "#60a5fa",
              }}
            >
              Worker Active
            </span>
          </div>
        </div>

        {/* Pilot Operating Definition */}
        <div
          style={{
            background: "rgba(124, 58, 237, 0.04)",
            border: "1px solid var(--violet-950)",
            borderRadius: "var(--radius-sm)",
            padding: "14px 16px",
            fontSize: "0.82rem",
            color: "var(--text-2)",
            lineHeight: 1.5,
          }}
        >
          <strong>Maddad Pilot Framework:</strong> Maddad is a direct job board connecting customers and independent plumbing &amp; electrical workers in Lahore. Maddad does not employ technicians, schedule visits, guarantee workmanship, or hold escrow funds. All compensation is settled directly between the customer and technician in cash or digital wallet.
        </div>

        {/* Danger Zone: Account Deletion */}
        <div
          style={{
            borderTop: "1px solid var(--graphite-800)",
            paddingTop: 18,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconAlertCircle size={16} color="var(--rose-400)" />
            <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--rose-400)" }}>
              Danger Zone · Delete Account
            </span>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-3)", margin: 0 }}>
            Permanently erase your profile, active listings, and unfulfilled bids from the Lahore database.
          </p>
          <div style={{ marginTop: 4 }}>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="btn btn-ghost btn-sm"
              style={{
                color: "var(--rose-400)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
              }}
            >
              <span>{deleting ? "Deleting..." : "Permanently Delete My Account"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
