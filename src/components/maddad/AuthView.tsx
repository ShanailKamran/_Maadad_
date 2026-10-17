"use client";

import React, { useState, useTransition } from "react";
import {
  IconPhone,
  IconShield,
  IconCheck,
  IconArrowRight,
  IconAlertCircle,
  IconLogOut,
  IconUsers,
} from "../icons";
import {
  AppUser,
  DemoAccount,
} from "./types";
import {
  requestOtpAction,
  verifyOtpAction,
  switchDemoUserAction,
  logoutAction,
} from "@/app/actions";
import { DemoBadge } from "./shared";

interface AuthViewProps {
  currentUser: AppUser | null;
  demoAccounts: DemoAccount[] | null;
  onNavigateMarketplace: () => void;
  showToast: (msg: string) => void;
}

export function AuthView({
  currentUser,
  demoAccounts,
  onNavigateMarketplace,
  showToast,
}: AuthViewProps) {
  const [isPending, startTransition] = useTransition();

  // OTP form state
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!phone.trim()) {
      setFormError("Please enter a valid Pakistani mobile number.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("phone", phone.trim());
    const res = await requestOtpAction(null, fd);
    setBusy(false);

    if (res?.error) {
      setFormError(res.error);
    } else {
      setOtpSent(true);
      if (res?.devCode) {
        setDevCode(res.devCode);
      }
      showToast(res?.ok || "Verification code dispatched via SMS.");
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!code.trim()) {
      setFormError("Please enter the 6-digit code.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("phone", phone.trim());
    fd.set("code", code.trim());
    const res = await verifyOtpAction(null, fd);
    setBusy(false);

    if (res?.error) {
      setFormError(res.error);
    } else {
      showToast("Signed in successfully!");
      window.location.reload();
    }
  };

  const handleDemoSwitch = (demoPhone: string) => {
    startTransition(async () => {
      const res = await switchDemoUserAction(demoPhone);
      if (res?.error) {
        showToast(`Demo switch error: ${res.error}`);
      } else {
        showToast("Switched demo persona.");
        window.location.reload();
      }
    });
  };

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
      window.location.reload();
    });
  };

  return (
    <div style={{ maxWidth: 580, margin: "24px auto", width: "100%", padding: "0 12px" }}>
      {/* Active Session Status if logged in */}
      {currentUser && (
        <div
          className="plate"
          style={{
            marginBottom: 20,
            borderColor: "rgba(16, 185, 129, 0.4)",
            background:
              "linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(13, 17, 23, 0.95) 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--emerald-400)",
                    boxShadow: "0 0 8px var(--emerald-400)",
                  }}
                />
                <span style={{ fontSize: "0.8rem", color: "var(--emerald-300)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Active Session
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-1)", marginTop: 2 }}>
                {currentUser.display_name || "Maddad User"}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-3)", fontFamily: "monospace" }}>
                {currentUser.phone} · Role: {currentUser.is_worker ? "Technician" : "Customer"}
                {currentUser.is_admin ? " + Admin" : ""}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onNavigateMarketplace}
                className="btn btn-secondary btn-sm"
              >
                Go to Marketplace
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--rose-400)" }}
              >
                <IconLogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Sign-In Plate */}
      <div className="plate-bolted">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(135deg, var(--violet-600) 0%, var(--violet-800) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "1.25rem",
              color: "#fff",
              boxShadow: "var(--glow-violet)",
              border: "1px solid var(--violet-400)",
            }}
          >
            مدد
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "var(--text-1)" }}>
              Sign In to Maddad Lahore
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--violet-300)" }}>
              پلمبنگ اور الیکٹریکل سروسز کے لیے لاگ ان کریں
            </p>
          </div>
        </div>

        {/* Operating Definition */}
        <div
          style={{
            background: "rgba(124, 58, 237, 0.06)",
            border: "1px solid var(--violet-900)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            fontSize: "0.82rem",
            color: "var(--text-2)",
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          <strong>Lahore-Only Marketplace:</strong> Maddad is a direct job board for Lahore. No passwords required — sign in with your Pakistani mobile number via SMS OTP code.
        </div>

        {/* SMS OTP Form */}
        {!otpSent ? (
          <form onSubmit={handleRequestOtp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label
                htmlFor="auth-phone-input"
                style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}
              >
                Pakistani Mobile Number (موبائل نمبر):
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="auth-phone-input"
                  type="tel"
                  placeholder="0300 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  style={{
                    width: "100%",
                    background: "var(--ink-0)",
                    border: "1px solid var(--graphite-600)",
                    borderRadius: "var(--radius-sm)",
                    padding: "11px 14px 11px 40px",
                    color: "var(--text-1)",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-3)",
                    display: "flex",
                  }}
                >
                  <IconPhone size={16} />
                </span>
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-3)", marginTop: 4 }}>
                Enter your 11-digit mobile number starting with 03.
              </div>
            </div>

            {formError && (
              <div
                style={{
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid var(--rose-500)",
                  color: "var(--rose-300)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconAlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px 18px" }}
            >
              <span>{busy ? "Sending Code..." : "Send Verification Code (کوڈ بھیجیں)"}</span>
              <IconArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.82rem",
                color: "var(--emerald-300)",
              }}
            >
              SMS sent to <strong>{phone}</strong>. Enter the 6-digit verification code below.
            </div>

            {devCode && (
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px dashed var(--amber-400)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.8rem",
                  color: "var(--amber-300)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Development SMS bypass code: <strong>{devCode}</strong></span>
                <button
                  type="button"
                  onClick={() => setCode(devCode)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--amber-300)", padding: "2px 8px", fontSize: "0.75rem" }}
                >
                  Autofill
                </button>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-code-input"
                style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}
              >
                6-Digit Verification Code:
              </label>
              <input
                id="auth-code-input"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                style={{
                  width: "100%",
                  background: "var(--ink-0)",
                  border: "1px solid var(--graphite-600)",
                  borderRadius: "var(--radius-sm)",
                  padding: "11px 14px",
                  color: "var(--text-1)",
                  fontSize: "1.2rem",
                  letterSpacing: "6px",
                  textAlign: "center",
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
            </div>

            {formError && (
              <div
                style={{
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid var(--rose-500)",
                  color: "var(--rose-300)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconAlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setCode("");
                  setDevCode(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center" }}
              >
                Change Number
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: "center" }}
              >
                <IconCheck size={16} />
                <span>{busy ? "Verifying..." : "Verify & Sign In"}</span>
              </button>
            </div>
          </form>
        )}

        {/* Demo Personas Section - Gated and labeled */}
        {demoAccounts && demoAccounts.length > 0 && (
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: "1px solid var(--graphite-800)",
            }}
          >
            {/* Caution banner for fictional demo data */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)",
                borderLeft: "3px solid var(--amber-400)",
                borderRadius: "var(--radius-sm)",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconShield size={16} color="var(--amber-400)" />
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--amber-300)" }}>
                  Testing Persona Switcher
                </span>
              </div>
              <DemoBadge />
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--text-3)", margin: "0 0 12px" }}>
              Click any fictional persona below to immediately simulate customer, technician, or moderator workflows without receiving an SMS.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {demoAccounts.map((demo) => {
                const isSelected = currentUser && currentUser.phone.replace(/\s+/g, "") === demo.phone.replace(/\s+/g, "");
                return (
                  <button
                    key={demo.phone}
                    type="button"
                    onClick={() => handleDemoSwitch(demo.phone)}
                    disabled={isPending}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      textAlign: "left",
                      padding: "10px 12px",
                      background: isSelected ? "rgba(124, 58, 237, 0.18)" : "var(--ink-0)",
                      border: isSelected ? "1px solid var(--violet-400)" : "1px solid var(--graphite-700)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      transition: "var(--transition-fast)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: isSelected ? "var(--violet-200)" : "var(--text-1)" }}>
                        {demo.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background:
                            demo.role.toLowerCase() === "customer"
                              ? "rgba(124, 58, 237, 0.2)"
                              : demo.role.toLowerCase().includes("electric")
                              ? "rgba(245, 158, 11, 0.2)"
                              : demo.role.toLowerCase().includes("plumb")
                              ? "rgba(59, 130, 246, 0.2)"
                              : "rgba(244, 63, 94, 0.2)",
                          color:
                            demo.role.toLowerCase() === "customer"
                              ? "var(--violet-300)"
                              : demo.role.toLowerCase().includes("electric")
                              ? "var(--amber-300)"
                              : demo.role.toLowerCase().includes("plumb")
                              ? "#60a5fa"
                              : "var(--rose-400)",
                        }}
                      >
                        {demo.role}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-3)", lineHeight: 1.3 }}>
                      {demo.blurb}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Continue as guest */}
        <div style={{ marginTop: 20, textAlign: "center", borderTop: "1px solid var(--graphite-800)", paddingTop: 16 }}>
          <button
            type="button"
            onClick={onNavigateMarketplace}
            className="btn btn-ghost"
            style={{ fontSize: "0.85rem", color: "var(--text-2)" }}
          >
            <span>Or browse jobs as a guest</span>
            <IconArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
